/**
 * 数据库清理脚本
 * 清理过期的房间、会话、临时事件等数据
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function cleanupDatabase() {
  console.log('========================================');
  console.log('数据库清理工具');
  console.log('========================================\n');

  try {
    await prisma.$connect();
    console.log('✓ 数据库连接成功\n');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalDeleted = 0;

    // 1. 删除已关闭超过7天的房间
    console.log('[1/4] 清理过期的房间...');
    const closedRooms = await prisma.room.findMany({
      where: {
        status: { in: ['closed', 'finished'] },
        finishedAt: { lt: sevenDaysAgo },
      },
      select: { id: true },
    });

    if (closedRooms.length > 0) {
      // 删除房间会自动级联删除 RoomPlayer, HostConfig, GameSession 等
      const deletedRooms = await prisma.room.deleteMany({
        where: {
          status: { in: ['closed', 'finished'] },
          finishedAt: { lt: sevenDaysAgo },
        },
      });
      console.log(`  ✓ 已删除 ${deletedRooms.count} 个过期房间`);
      totalDeleted += deletedRooms.count;
    } else {
      console.log('  ✓ 没有过期的房间');
    }
    console.log('');

    // 2. 删除已结束超过7天的游戏会话
    console.log('[2/4] 清理过期的游戏会话...');
    const finishedSessions = await prisma.gameSession.findMany({
      where: {
        status: 'finished',
        updatedAt: { lt: sevenDaysAgo },
      },
      select: { id: true },
    });

    if (finishedSessions.length > 0) {
      const deletedSessions = await prisma.gameSession.deleteMany({
        where: {
          status: 'finished',
          updatedAt: { lt: sevenDaysAgo },
        },
      });
      console.log(`  ✓ 已删除 ${deletedSessions.count} 个过期会话`);
      totalDeleted += deletedSessions.count;
    } else {
      console.log('  ✓ 没有过期的会话');
    }
    console.log('');

    // 3. 删除过期的临时事件
    console.log('[3/4] 清理过期的临时事件...');
    const expiredEvents = await prisma.temporaryEvent.findMany({
      where: {
        OR: [
          { completedAt: { lt: sevenDaysAgo } },
          { 
            completedAt: null,
            createdAt: { lt: thirtyDaysAgo }, // 未完成但超过30天的事件
          },
        ],
      },
      select: { id: true },
    });

    if (expiredEvents.length > 0) {
      const deletedEvents = await prisma.temporaryEvent.deleteMany({
        where: {
          OR: [
            { completedAt: { lt: sevenDaysAgo } },
            { 
              completedAt: null,
              createdAt: { lt: thirtyDaysAgo },
            },
          ],
        },
      });
      console.log(`  ✓ 已删除 ${deletedEvents.count} 个过期事件`);
      totalDeleted += deletedEvents.count;
    } else {
      console.log('  ✓ 没有过期的事件');
    }
    console.log('');

    // 4. 删除已离开房间超过30天的玩家记录
    console.log('[4/4] 清理过期的玩家记录...');
    const oldPlayerRecords = await prisma.roomPlayer.findMany({
      where: {
        status: 'left',
        leftAt: { lt: thirtyDaysAgo },
      },
      select: { id: true },
    });

    if (oldPlayerRecords.length > 0) {
      const deletedPlayers = await prisma.roomPlayer.deleteMany({
        where: {
          status: 'left',
          leftAt: { lt: thirtyDaysAgo },
        },
      });
      console.log(`  ✓ 已删除 ${deletedPlayers.count} 条过期玩家记录`);
      totalDeleted += deletedPlayers.count;
    } else {
      console.log('  ✓ 没有过期的玩家记录');
    }
    console.log('');

    console.log('========================================');
    console.log('清理完成！');
    console.log('========================================');
    console.log(`总计删除: ${totalDeleted} 条记录\n`);

  } catch (error: any) {
    console.error('❌ 清理失败:', error.message);
    if (error.code === 'P1001') {
      console.error('   数据库连接失败，请检查 DATABASE_URL 配置');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase().catch((error) => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

