import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as ci from 'miniprogram-ci';

export interface MiniprogramUploadParams {
  appId: string;
  /** 待上传的项目目录（原生小程序为仓库根，UniApp 为 distPath） */
  projectPath: string;
  privateKeyPath: string;
  version: string;
  desc: string;
  /** 微信上传机器人编号 1-30，用于隔离并发上传，避免体验版互相覆盖 */
  robotId: number;
  onLog: (message: string) => void;
}

/**
 * 封装 miniprogram-ci 的上传与预览。
 *
 * 抽离原因：主流程与「历史版本重传」两条路径原先各写了一遍
 * ci.Project / upload / preview / 缓存清理，任何一处改动都要同步两份。
 */
@Injectable()
export class MiniprogramUploader {
  /**
   * 上传代码并生成体验版二维码。
   * @param qrcodeDest 二维码落盘的绝对路径
   */
  async uploadAndPreview(params: MiniprogramUploadParams, qrcodeDest: string): Promise<void> {
    const mpProject = new ci.Project({
      appid: params.appId,
      type: 'miniProgram',
      projectPath: params.projectPath,
      privateKeyPath: params.privateKeyPath,
      ignores: ['node_modules/**/*'],
    });

    try {
      await ci.upload({
        project: mpProject,
        version: params.version,
        desc: params.desc,
        setting: { es6: true, minify: true },
        robot: params.robotId,
        onProgressUpdate: (task: any) => params.onLog(`[CI] ${JSON.stringify(task)}...`),
      });
      params.onLog('成功上传到微信！');

      params.onLog('[CI] 正在生成体验版二维码...');
      await ci.preview({
        project: mpProject,
        version: params.version,
        desc: params.desc,
        setting: { es6: true, minify: true },
        robot: params.robotId,
        qrcodeFormat: 'image',
        qrcodeOutputDest: qrcodeDest,
        onProgressUpdate: (task: any) => {
          if (task._status === 'doing') {
            params.onLog(`[CI] ${task._msg}...`);
          } else if (task._status === 'done') {
            params.onLog(`[CI] ✔ ${task._msg}`);
          }
        },
      });
    } finally {
      await this.cleanupSummerCache(params.projectPath);
    }
  }

  /**
   * 清理 miniprogram-ci 在 cwd 下生成的 md5 哈希缓存目录。
   * 目录名算法来自 miniprogram-ci 的 createSummer.js（md5(projectPath + '|summer')）。
   */
  private async cleanupSummerCache(projectPath: string): Promise<void> {
    try {
      const cacheDirHash = crypto
        .createHash('md5')
        .update(projectPath + '|summer')
        .digest('hex');
      const cacheDirPath = path.join(process.cwd(), cacheDirHash);
      if (await fs.pathExists(cacheDirPath)) {
        await fs.remove(cacheDirPath);
      }
    } catch {
      // 清理失败不应影响构建结果
    }
  }
}
