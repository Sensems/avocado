export const BUILD_QUEUE_NAME = 'build-queue';

export type TriggerType = 'manual' | 'webhook' | 'reupload';

export interface BuildJobData {
  taskId: string;
  projectId: string;
  branch: string;
  version?: string;
  buildDesc?: string;
  triggeredById?: string; // Null if triggered by webhook
  triggerType: TriggerType;
  triggerUserName?: string;
  commitMessage?: string;
  commitAuthor?: string;
  /** 历史版本快速上传时：源任务 ID（从中取出 artifactPath） */
  sourceArtifactTaskId?: string;
}
