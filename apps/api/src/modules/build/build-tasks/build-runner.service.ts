import { Injectable, Logger } from '@nestjs/common';
import { isSafeBranchName } from '../../../common/utils/branch.util';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { GitCredentialType } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  buildGitAuthContext,
  buildNoAuthContext,
  type GitAuthContext,
} from '../../../common/utils/git-auth.helper';

const execFileAsync = promisify(execFile);

/** 命令执行超时（10 分钟） */
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

/** 依赖缓存上限，超过后整目录重建 */
const CACHE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;

export interface GitCredentialInput {
  name: string;
  type: GitCredentialType;
  username?: string | null;
  plainSecret: string;
}

/**
 * 构建执行器：负责与外部世界打交道的那一层。
 *
 * 包含 clone、依赖安装、构建命令、命令执行与超时、依赖缓存管理。
 * 不持有任何构建任务状态，所有输出通过 onLog 回调交给调用方，
 * 便于单测和复用（重传、未来可能的本地构建都不需要重写这套逻辑）。
 */
@Injectable()
export class BuildRunner {
  private readonly logger = new Logger(BuildRunner.name);

  /** 上次检查缓存体积的时间戳，避免每次构建都递归统计大目录 */
  private lastCachePruneAt = 0;

  /**
   * 克隆仓库并返回 HEAD 提交号。凭证临时文件在克隆结束后立即销毁。
   */
  async cloneRepo(params: {
    repoUrl: string;
    branch: string;
    workspaceDir: string;
    credential: GitCredentialInput | null;
    onLog: (message: string) => void;
  }): Promise<string | null> {
    const { repoUrl, branch, workspaceDir, credential, onLog } = params;

    let gitAuth: GitAuthContext = buildNoAuthContext();
    if (credential) {
      try {
        gitAuth = await buildGitAuthContext(
          {
            type: credential.type,
            username: credential.username,
            plainSecret: credential.plainSecret,
          },
          repoUrl,
        );
        onLog(`已加载 Git 凭证: ${credential.name}`);
      } catch (e) {
        onLog(`[WARN] 加载 Git 凭证失败，将尝试匿名克隆: ${(e as Error).message}`);
      }
    }

    this.assertSafeBranch(branch);

    try {
      await this.runExec(
        'git',
        [...gitAuth.extraArgs, 'clone', '--depth', '50', '-b', branch, repoUrl, '.'],
        workspaceDir,
        onLog,
        gitAuth.env,
      );
      onLog('克隆成功。');
      return await this.resolveCommitHash(workspaceDir, gitAuth.env);
    } finally {
      // 临时凭证文件必须在克隆完成后立即销毁
      await gitAuth.cleanup();
    }
  }

  /**
   * 安装依赖。未找到 package.json 时直接跳过。
   */
  async installDependencies(workspaceDir: string, onLog: (message: string) => void): Promise<void> {
    if (!(await fs.pathExists(path.join(workspaceDir, 'package.json')))) {
      onLog('未找到 package.json，跳过依赖安装。');
      return;
    }
    const command = await this.detectInstallCommand(workspaceDir);
    onLog(`使用命令: ${command}`);
    await this.runShell(command, workspaceDir, onLog);
    onLog('依赖安装完成。');
  }

  /**
   * 执行用户配置的构建命令。
   * UniApp 项目必须显式配置，原生小程序可选。
   */
  async runBuild(
    params: {
      workspaceDir: string;
      buildCommand: string | null;
      framework: string;
      onLog: (message: string) => void;
    },
  ): Promise<void> {
    const { workspaceDir, buildCommand, framework, onLog } = params;

    if (framework === 'uniapp' && !buildCommand) {
      throw new Error('UniApp 项目需要构建命令 (例如 npm run build:mp-weixin)');
    }
    if (!buildCommand) {
      return;
    }

    await this.runShell(buildCommand, workspaceDir, onLog);
    onLog('构建命令完成。');
  }

  /**
   * 校验分支名，防止通过分支参数注入命令。
   * webhook 的 payload 来自外部，这里是最后一道防线
   * （第一道在 triggerBuild / retryTask，用同一份规则）。
   */
  assertSafeBranch(branch: string): void {
    if (!isSafeBranchName(branch)) {
      throw new Error(`非法的分支名: ${branch}`);
    }
  }

  /** 读取工作区当前 HEAD 的 commit hash，失败返回 null（不影响构建） */
  async resolveCommitHash(cwd: string, env?: NodeJS.ProcessEnv): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd,
        env,
        timeout: 10_000,
      });
      const hash = String(stdout).trim();
      return /^[0-9a-f]{40}$/.test(hash) ? hash : null;
    } catch {
      return null;
    }
  }

  /** 递归统计目录体积（字节），用于记录包体积 */
  async dirSize(dir: string): Promise<number> {
    let total = 0;
    const walk = async (current: string): Promise<void> => {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          total += (await fs.stat(full)).size;
        }
      }
    };
    await walk(dir).catch(() => {});
    return total;
  }

  /**
   * 执行用户配置的自由命令（依赖安装 / 构建）。
   * 这类命令本质上就是 shell 脚本，必须走 shell，因此只允许受信任成员配置。
   */
  private runShell(
    command: string,
    cwd: string,
    onLog: (message: string) => void,
    extraEnv?: NodeJS.ProcessEnv,
  ): Promise<void> {
    return this.spawnAndStream(command, [], cwd, onLog, { shell: true, env: extraEnv });
  }

  /**
   * 执行固定命令 + 参数数组，不经过 shell，参数中的特殊字符不会被解释。
   */
  private runExec(
    file: string,
    args: string[],
    cwd: string,
    onLog: (message: string) => void,
    extraEnv?: NodeJS.ProcessEnv,
  ): Promise<void> {
    return this.spawnAndStream(file, args, cwd, onLog, { shell: false, env: extraEnv });
  }

  /**
   * spawn 子进程并实时流式推送 stdout/stderr。
   */
  private spawnAndStream(
    file: string,
    args: string[],
    cwd: string,
    onLog: (message: string) => void,
    options: { shell: boolean; env?: NodeJS.ProcessEnv },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(file, args, {
        cwd,
        shell: options.shell,
        env: { ...process.env, CI: 'true', ...options.env },
      });

      let lastStderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        for (const line of data.toString().trim().split('\n')) {
          if (line.trim()) onLog(line);
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        lastStderr = text;
        for (const line of text.split('\n')) {
          if (line.trim()) onLog(`[stderr] ${line}`);
        }
      });

      let settled = false;
      let timer: NodeJS.Timeout | undefined;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        fn();
      };

      child.on('close', (code) => {
        if (code === 0) {
          finish(() => resolve());
        } else {
          finish(() => reject(new Error(lastStderr || `命令退出码: ${code}`)));
        }
      });

      child.on('error', (err) => {
        finish(() => reject(err));
      });

      // 超时先 SIGTERM，5 秒后仍未退出则 SIGKILL，避免子进程树残留
      timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000).unref();
        finish(() => reject(new Error('命令执行超时 (10 分钟)')));
      }, COMMAND_TIMEOUT_MS);
      timer.unref();
      if (settled) clearTimeout(timer);
    });
  }

  /**
   * 根据 lock 文件、packageManager 字段、preinstall 脚本检测包管理器，
   * 并把依赖缓存指向持久目录，避免每次都全量重新下载。
   */
  private async detectInstallCommand(workspaceDir: string): Promise<string> {
    const cacheRoot = path.join(process.cwd(), 'var', 'cache');
    await this.maybePruneCache(cacheRoot);

    const pnpmStore = path.join(cacheRoot, 'pnpm');
    const yarnCache = path.join(cacheRoot, 'yarn');
    const npmCache = path.join(cacheRoot, 'npm');
    const pnpmCmd = `pnpm install --no-frozen-lockfile --store-dir "${pnpmStore}"`;
    const yarnCmd = `yarn install --cache-folder "${yarnCache}"`;

    if (await fs.pathExists(path.join(workspaceDir, 'pnpm-lock.yaml'))) return pnpmCmd;
    if (await fs.pathExists(path.join(workspaceDir, 'yarn.lock'))) return yarnCmd;

    try {
      const pkgJson = (await fs.readJson(path.join(workspaceDir, 'package.json'))) as {
        packageManager?: string;
        scripts?: { preinstall?: string };
      };
      const packageManager = pkgJson.packageManager;
      const preinstall = pkgJson.scripts?.preinstall;

      if (packageManager?.startsWith('pnpm') || preinstall?.includes('only-allow pnpm')) {
        return pnpmCmd;
      }
      if (packageManager?.startsWith('yarn') || preinstall?.includes('only-allow yarn')) {
        return yarnCmd;
      }
    } catch {
      // package.json 解析失败则忽略
    }

    return `npm install --legacy-peer-deps --force --cache "${npmCache}"`;
  }

  /**
   * 依赖缓存超过上限时整目录清理。每 6 小时最多检查一次。
   */
  private async maybePruneCache(cacheRoot: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastCachePruneAt < 6 * 60 * 60 * 1000) return;
    this.lastCachePruneAt = now;

    try {
      if (!(await fs.pathExists(cacheRoot))) return;
      const size = await this.dirSize(cacheRoot);
      if (size > CACHE_LIMIT_BYTES) {
        this.logger.warn(
          `构建缓存已达 ${(size / 1024 / 1024 / 1024).toFixed(1)}GB，超过上限，清理重建`,
        );
        await fs.remove(cacheRoot);
      }
    } catch {
      // 清理失败不影响构建
    }
  }
}
