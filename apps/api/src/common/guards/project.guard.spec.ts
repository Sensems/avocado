jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  ProjectRole: { maintainer: 'maintainer', developer: 'developer', guest: 'guest' },
}));

import { ForbiddenException } from '@nestjs/common';
import { ProjectGuard } from './project.guard';

describe('ProjectGuard', () => {
  let guard: ProjectGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: any;

  const makeCtx = (request: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  const member = (role: string) => ({
    findFirst: jest.fn().mockResolvedValue({ role }),
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    prisma = { projectMember: member('developer'), buildTask: { findUnique: jest.fn() } };
    guard = new ProjectGuard(reflector as any, prisma);
  });

  it('未声明所需角色时不拦截（保持既有行为，避免误伤公开接口）', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeCtx({ params: {}, body: {}, query: {}, user: { id: 'u1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
  });

  it('超级管理员跳过项目角色校验', async () => {
    reflector.getAllAndOverride.mockReturnValue(['maintainer']);
    const ctx = makeCtx({
      params: { id: 'p1' },
      body: {},
      query: {},
      user: { id: 'u1', isSuperAdmin: true },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findFirst).not.toHaveBeenCalled();
  });

  it('缺少用户对象时拒绝', async () => {
    reflector.getAllAndOverride.mockReturnValue(['guest']);
    const ctx = makeCtx({ params: { id: 'p1' }, body: {}, query: {} });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('非项目成员被拒绝', async () => {
    reflector.getAllAndOverride.mockReturnValue(['guest']);
    prisma.projectMember = member('');
    prisma.projectMember.findFirst.mockResolvedValue(null);

    const ctx = makeCtx({
      params: { id: 'p1' },
      body: {},
      query: {},
      user: { id: 'u1', isSuperAdmin: false },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow('您不是该项目的成员');
  });

  it('角色不在允许列表时被拒绝', async () => {
    reflector.getAllAndOverride.mockReturnValue(['maintainer']);
    prisma.projectMember = member('developer');

    const ctx = makeCtx({
      params: { id: 'p1' },
      body: {},
      query: {},
      user: { id: 'u1', isSuperAdmin: false },
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('角色匹配时放行', async () => {
    reflector.getAllAndOverride.mockReturnValue(['maintainer', 'developer']);
    prisma.projectMember = member('developer');

    const ctx = makeCtx({
      params: { projectId: 'p1' },
      body: {},
      query: {},
      user: { id: 'u1', isSuperAdmin: false },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('路由参数为 :id 时也能识别项目（project-core 用的是 :id）', async () => {
    reflector.getAllAndOverride.mockReturnValue(['guest']);
    prisma.projectMember = member('guest');

    const ctx = makeCtx({
      params: { id: 'p1' },
      body: {},
      query: {},
      user: { id: 'u1', isSuperAdmin: false },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'p1', userId: 'u1' },
    });
  });

  it('任务级路由通过 taskId 反查所属项目', async () => {
    reflector.getAllAndOverride.mockReturnValue(['developer']);
    prisma.projectMember = member('developer');
    prisma.buildTask.findUnique.mockResolvedValue({ projectId: 'p-from-task' });

    const ctx = makeCtx({
      params: { taskId: '42' },
      body: {},
      query: {},
      user: { id: 'u1', isSuperAdmin: false },
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.buildTask.findUnique).toHaveBeenCalledWith({
      where: { id: 42n },
      select: { projectId: true },
    });
    expect(prisma.projectMember.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'p-from-task', userId: 'u1' },
    });
  });
});
