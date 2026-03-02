import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitCredentialType } from '@prisma/client';

const execAsync = promisify(exec);

export interface GitAuthContext {
  /** 注入到子进程的额外环境变量 */
  env: NodeJS.ProcessEnv;
  /** 需要插入到 `git` 命令之后、子命令之前的 -c 参数字符串，可能为空 */
  extraArgs: string;
  /** 用完后必须调用的清理函数，删除临时文件 */
  cleanup: () => Promise<void>;
}

export interface GitCredentialInfo {
  type: GitCredentialType;
  username?: string | null;
  /** 已解密的明文密钥 / token / 密码 */
  plainSecret: string;
}

/**
 * 根据凭证信息构建 git 认证上下文
 *
 * - SSH 凭证：将私钥写入临时文件并设置 GIT_SSH_COMMAND（跨平台）
 * - HTTPS 凭证：写入临时 git-credentials store 文件并用 -c credential.helper 注入
 *   同时兼容 PAT（个人访问令牌）、普通密码，以及 GitHub/GitLab/Gitee 多平台
 *
 * @example
 * ```ts
 * const ctx = await buildGitAuthContext(credential, repoUrl);
 * try {
 *   await execAsync(`git ${ctx.extraArgs} clone ${repoUrl} .`, { env: ctx.env });
 * } finally {
 *   await ctx.cleanup();
 * }
 * ```
 */
export async function buildGitAuthContext(
  credential: GitCredentialInfo,
  repoUrl: string,
): Promise<GitAuthContext> {
  const tempFiles: string[] = [];
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // 关闭交互式提示，避免 git 挂起等待用户输入
    GIT_TERMINAL_PROMPT: '0',
  };
  let extraArgs = '';

  if (credential.type === GitCredentialType.ssh) {
    // ── SSH 认证 ────────────────────────────────────────────────────────────
    const keyPath = join(tmpdir(), `id_rsa_build_${Date.now()}`);
    tempFiles.push(keyPath);
    await writeFile(keyPath, credential.plainSecret, { mode: 0o600 });
    // 使用正斜杠，兼容 Windows 路径在 GIT_SSH_COMMAND 字符串中的传递
    const normalizedKeyPath = keyPath.replace(/\\/g, '/');
    env['GIT_SSH_COMMAND'] =
      `ssh -i "${normalizedKeyPath}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
  } else {
    // ── HTTPS 认证（兼容 PAT / 密码 / GitHub / GitLab / Gitee）────────────
    //
    // 策略：写入临时 git credentials store 文件
    // 格式：https://username:token@hostname
    // git -c credential.helper="store --file <path>" 读取此文件
    //
    // 为什么不内嵌到 URL？
    //   Gitee/GitHub 等对 URL 内嵌凭证有兼容性问题；
    //   credential store 是 git 官方推荐的跨平台方式。
    const parsedUrl = new URL(repoUrl);
    const username = encodeURIComponent(credential.username ?? 'oauth2');
    const password = encodeURIComponent(credential.plainSecret);

    // 覆盖 protocol + hostname + port，支持自托管 GitLab / Gitee 私有域名
    const credLine = `${parsedUrl.protocol}//${username}:${password}@${parsedUrl.host}`;

    const credFilePath = join(tmpdir(), `git-creds-${Date.now()}.txt`);
    tempFiles.push(credFilePath);
    await writeFile(credFilePath, credLine + '\n', { mode: 0o600 });

    // Windows 路径转正斜杠（git 底层用 POSIX 路径）
    const gitCredFilePath = credFilePath.replace(/\\/g, '/');
    extraArgs = `-c credential.helper="store --file '${gitCredFilePath}'"`;
  }

  const cleanup = async () => {
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => {})));
  };

  return { env, extraArgs, cleanup };
}

/**
 * 无凭证时返回一个空上下文（公开仓库 / 已配置全局 git 凭证）
 */
export function buildNoAuthContext(): GitAuthContext {
  return {
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    extraArgs: '',
    cleanup: async () => {},
  };
}

/**
 * 通过 git ls-remote --heads 获取仓库分支列表，使用传入的认证上下文
 */
export async function listBranchesWithContext(
  repoUrl: string,
  ctx: GitAuthContext,
): Promise<string[]> {
  const { stdout } = await execAsync(
    `git ${ctx.extraArgs} ls-remote --heads "${repoUrl}"`,
    { env: ctx.env, timeout: 30_000 },
  );

  return stdout
    .split('\n')
    .filter((line) => line.includes('refs/heads/'))
    .map((line) => line.split('refs/heads/')[1]?.trim())
    .filter((b): b is string => Boolean(b));
}
