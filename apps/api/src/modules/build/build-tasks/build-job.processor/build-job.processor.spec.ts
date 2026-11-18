// Prisma 的查询引擎在 Jest 里会因 ESM/CJS 互操作失败，单测不需要真实数据库
jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  Prisma: { DbNull: 'DbNull', JsonNull: 'JsonNull' },
  TaskStatus: {
    pending: 'pending',
    running: 'running',
    success: 'success',
    failed: 'failed',
    canceled: 'canceled',
  },
  GitCredentialType: { ssh: 'ssh', https: 'https', pat: 'pat' },
  FrameworkType: { native: 'native', uniapp: 'uniapp' },
  ProjectRole: { maintainer: 'maintainer', developer: 'developer', guest: 'guest' },
  ImPlatform: { wecom: 'wecom', dingtalk: 'dingtalk', feishu: 'feishu' },
  GlobalStatus: { active: 'active', disabled: 'disabled' },
}));

import { EventEmitter } from 'events';
import { DelayedError } from 'bullmq';
import { BuildJobProcessor } from './build-job.processor';
import { MiniprogramUploader } from '../miniprogram-uploader.service';
import { BuildRunner } from '../build-runner.service';

// ---- 外部依赖全部 mock 掉：真实构建会 spawn、上传微信、写磁盘 ----
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(true),
  ensureDir: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  emptyDir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ size: 2048, mtimeMs: Date.now() }),
  appendFile: jest.fn().mockResolvedValue(undefined),
  readJson: jest.fn().mockResolvedValue({}),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('child_process', () => ({ spawn: jest.fn(), execFile: jest.fn() }));

jest.mock('miniprogram-ci', () => ({
  Project: jest.fn().mockImplementation(() => ({})),
  upload: jest.fn(),
  preview: jest.fn(),
}));

const fs = require('fs-extra');
const { spawn, execFile } = require('child_process');
const ci = require('miniprogram-ci');

/** 构造一个会立即成功退出的假子进程 */
function fakeChild(exitCode = 0, stderr = '') {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = jest.fn();
  process.nextTick(() => {
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', exitCode);
  });
  return child;
}

const PROJECT = {
  id: 'proj-1',
  name: 'demo',
  repoUrl: 'https://github.com/o/r.git',
  appId: 'wx1234567890',
  framework: 'native',
  distPath: null,
  buildCommand: null,
  privateKeyPath: '/tmp/private.key',
  historyEnabled: false,
  imRobots: [{ robotId: 'bot-1' }],
  gitCredential: null,
};

const JOB_DATA = {
  taskId: '1',
  projectId: 'proj-1',
  branch: 'main',
  version: '1.0.0',
  buildDesc: 'unit test',
  triggeredById: 'user-1',
  triggerType: 'manual' as const,
  triggerUserName: 'admin',
};

function buildProcessor() {
  const prisma = {
    buildTask: {
      findUnique: jest.fn().mockResolvedValue({ id: 1n, status: 'pending' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue(PROJECT),
    },
    imRobot: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const robotPool = {
    acquireRobotId: jest.fn().mockResolvedValue(1),
    releaseRobotId: jest.fn().mockResolvedValue(undefined),
  };
  const eventEmitter = { emit: jest.fn() };
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
  const artifacts = {
    archiveDirectory: jest.fn().mockResolvedValue('/storage/artifacts/1.zip'),
    enforceRetention: jest.fn().mockResolvedValue(undefined),
  };

  const processor = new BuildJobProcessor(
    prisma as any,
    robotPool as any,
    eventEmitter as any,
    artifacts as any,
    notifier as any,
    new MiniprogramUploader(),
    new BuildRunner(),
  );
  return { processor, prisma, robotPool, eventEmitter, artifacts, notifier };
}

function makeJob(overrides: Record<string, any> = {}) {
  return {
    id: 'job-1',
    data: { ...JOB_DATA, ...overrides },
    token: 'token',
    moveToDelayed: jest.fn().mockResolvedValue(undefined),
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  (spawn as jest.Mock).mockImplementation(() => fakeChild(0));
  // execFile 被 promisify 包装：必须真的调用回调，否则 Promise 永不 settle
  (execFile as jest.Mock).mockImplementation((...args: any[]) => {
    const callback = args.find((a) => typeof a === 'function');
    if (callback) callback(null, { stdout: `${'a'.repeat(40)}\n`, stderr: '' });
  });
  (ci.upload as jest.Mock).mockResolvedValue({});
  (ci.preview as jest.Mock).mockResolvedValue({});
  fs.pathExists.mockResolvedValue(true);
  fs.readFile.mockResolvedValue(Buffer.from('fake-image'));
});

describe('BuildJobProcessor', () => {
  it('正常构建：抢占任务、上传成功并写回 success 与包体积', async () => {
    const { processor, prisma, robotPool } = buildProcessor();

    await processor.process(makeJob());

    // 用乐观锁把 pending 改成 running
    expect(prisma.buildTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n, status: 'pending' },
        data: expect.objectContaining({ status: 'running', robotId: 1 }),
      }),
    );

    expect(ci.upload).toHaveBeenCalledTimes(1);
    // 机器人编号必须透传给微信，否则并发上传会互相覆盖体验版
    expect(ci.upload).toHaveBeenCalledWith(expect.objectContaining({ robot: 1 }));
    expect(ci.preview).toHaveBeenCalledWith(expect.objectContaining({ robot: 1 }));

    const finalWrite = prisma.buildTask.updateMany.mock.calls.find(
      (c: any[]) => c[0]?.data?.status === 'success',
    );
    expect(finalWrite).toBeDefined();
    expect(finalWrite![0].where).toEqual({ id: 1n, status: 'running' });
    expect(typeof finalWrite![0].data.packageSize).toBe('number');

    // 机器人编号必须在 finally 里归还
    expect(robotPool.releaseRobotId).toHaveBeenCalledWith(1);
  });

  it('上传失败：写入 failed 与 failReason，且不污染 logPath', async () => {
    const { processor, prisma, robotPool } = buildProcessor();
    (ci.upload as jest.Mock).mockRejectedValue(new Error('微信上传拒绝: 版本号重复'));

    await processor.process(makeJob());

    const failWrite = prisma.buildTask.updateMany.mock.calls.find(
      (c: any[]) => c[0]?.data?.status === 'failed',
    );
    expect(failWrite).toBeDefined();
    expect(failWrite![0].data.failReason).toContain('微信上传拒绝');
    expect(failWrite![0].data.logPath).not.toContain('微信上传拒绝');
    expect(failWrite![0].where.status).toEqual({ in: ['pending', 'running'] });

    expect(robotPool.releaseRobotId).toHaveBeenCalledWith(1);
  });

  it('机器人不可用：抛 DelayedError 且不消耗重试次数', async () => {
    const { processor, prisma, robotPool } = buildProcessor();
    robotPool.acquireRobotId.mockResolvedValue(null);

    const job = makeJob();

    await expect(processor.process(job)).rejects.toBeInstanceOf(DelayedError);

    expect(job.moveToDelayed).toHaveBeenCalled();
    // 不应进入执行阶段
    expect(prisma.buildTask.updateMany).not.toHaveBeenCalled();
    expect(ci.upload).not.toHaveBeenCalled();
  });

  it('任务已不是 pending：直接跳过，不重复上传（幂等）', async () => {
    const { processor, prisma } = buildProcessor();
    prisma.buildTask.findUnique.mockResolvedValue({ id: 1n, status: 'success' });

    await processor.process(makeJob());

    expect(ci.upload).not.toHaveBeenCalled();
    expect(prisma.buildTask.updateMany).not.toHaveBeenCalled();
  });
});
