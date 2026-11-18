// Prisma 的查询引擎在 Jest 下会因 ESM/CJS 互操作失败，这里只需要类型与空实现
jest.mock('@prisma/client', () => ({
  PrismaClient: class {},
  TaskStatus: { pending: 'pending', running: 'running', success: 'success' },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ArtifactsService } from './artifacts.service';

describe('ArtifactsService', () => {
  let service: ArtifactsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArtifactsService, PrismaService],
    }).compile();

    service = module.get<ArtifactsService>(ArtifactsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
