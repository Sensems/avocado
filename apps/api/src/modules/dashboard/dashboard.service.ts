import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { startOfDay, subDays } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = startOfDay(new Date());

    // 1. Overview Metrics
    const [totalProjects, totalUsers, todayBuilds, activeBuilds] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.user.count(),
      this.prisma.buildTask.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.buildTask.count({
        where: { status: 'running' },
      }),
    ]);

    // 2. Build Trends (Last 7 Days)
    const sevenDaysAgo = subDays(today, 6); // Includes today => 7 days
    const buildTasks = await this.prisma.buildTask.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, status: true },
    });

    const buildTrendsMap = new Map<string, { date: string; success: number; failed: number }>();
    for (let i = 0; i < 7; i++) {
       const dateStr = subDays(today, 6 - i).toISOString().split('T')[0];
       buildTrendsMap.set(dateStr, { date: dateStr, success: 0, failed: 0 });
    }

    for (const task of buildTasks) {
      const dateStr = task.createdAt.toISOString().split('T')[0];
      const entry = buildTrendsMap.get(dateStr);
      if (entry) {
        if (task.status === 'success') entry.success++;
        else if (task.status === 'failed') entry.failed++;
      }
    }
    const buildTrends = Array.from(buildTrendsMap.values());

    // 3. Project Distribution
    const projectGroupByFramework = await this.prisma.project.groupBy({
      by: ['framework'],
      _count: {
        _all: true,
      },
    });
    
    const frameworkDistribution = projectGroupByFramework.map((item) => ({
      name: item.framework,
      value: item._count._all,
    }));

    // 4. Top Active Projects (by build count)
    const topProjectsRaw = await this.prisma.buildTask.groupBy({
      by: ['projectId'],
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          projectId: 'desc',
        },
      },
      take: 5,
    });

    const topProjectsRawIds = topProjectsRaw.map(p => p.projectId);
    const topProjectDetails = await this.prisma.project.findMany({
      where: { id: { in: topProjectsRawIds } },
      select: { id: true, name: true }
    });

    const topProjects = topProjectsRaw.map(p => {
      const detail = topProjectDetails.find(d => d.id === p.projectId);
      return {
        id: p.projectId,
        name: detail?.name || 'Unknown',
        buildCount: p._count._all,
      };
    });

    // 5. Recent Activity
    const recentActivityRaw = await this.prisma.buildTask.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        version: true,
        branch: true,
        createdAt: true,
        project: {
          select: { name: true },
        },
        triggerUser: {
          select: { username: true },
        },
      },
    });

    const recentActivity = recentActivityRaw.map(item => ({
       id: item.id.toString(), // BigInt serialized to String
       status: item.status,
       version: item.version,
       branch: item.branch,
       createdAt: item.createdAt,
       projectName: item.project.name,
       triggerUser: item.triggerUser.username
    }));

    return {
      overview: {
        totalProjects,
        totalUsers,
        todayBuilds,
        activeBuilds,
      },
      buildTrends,
      frameworkDistribution,
      topProjects,
      recentActivity,
    };
  }
}
