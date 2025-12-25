/**
 * 数据库重置脚本
 * 完全清空所有表的数据，但保留表结构
 * 
 * 警告：此操作会删除所有数据，请谨慎使用！
 * 
 * Usage: npm run reset:db
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

dotenv.config();

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// 创建命令行输入接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function resetDatabase() {
  console.log('========================================');
  console.log('⚠️  数据库重置工具');
  console.log('========================================\n');
  console.log('警告：此操作将删除所有数据！');
  console.log('表结构将被保留，但所有记录将被清空。\n');

  try {
    await prisma.$connect();
    console.log('✓ 数据库连接成功\n');

    // 安全确认
    const answer = await question('请输入 "RESET" 以确认清空数据库: ');
    
    if (answer !== 'RESET') {
      console.log('\n❌ 操作已取消');
      rl.close();
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('\n开始清空数据库...\n');

    // 按照外键依赖关系的逆序删除数据
    // 这样可以避免外键约束错误

    let totalDeleted = 0;

    // 1. 删除任务进度（依赖 Task 和 User）
    console.log('[1/12] 清空任务进度...');
    const taskProgressCount = await prisma.taskProgress.deleteMany({});
    console.log(`  ✓ 已删除 ${taskProgressCount.count} 条任务进度记录`);
    totalDeleted += taskProgressCount.count;

    // 2. 删除任务（依赖 GameSession）
    console.log('[2/12] 清空任务...');
    const taskCount = await prisma.task.deleteMany({});
    console.log(`  ✓ 已删除 ${taskCount.count} 条任务记录`);
    totalDeleted += taskCount.count;

    // 3. 删除策略（依赖 User）
    console.log('[3/12] 清空策略...');
    const strategyCount = await prisma.strategy.deleteMany({});
    console.log(`  ✓ 已删除 ${strategyCount.count} 条策略记录`);
    totalDeleted += strategyCount.count;

    // 4. 删除游戏存档（依赖 GameSession 和 User）
    console.log('[4/12] 清空游戏存档...');
    const gameSaveCount = await prisma.gameSave.deleteMany({});
    console.log(`  ✓ 已删除 ${gameSaveCount.count} 条游戏存档记录`);
    totalDeleted += gameSaveCount.count;

    // 5. 删除交易（依赖 GameSession 和 User）
    console.log('[5/12] 清空交易记录...');
    const tradeCount = await prisma.trade.deleteMany({});
    console.log(`  ✓ 已删除 ${tradeCount.count} 条交易记录`);
    totalDeleted += tradeCount.count;

    // 6. 删除临时事件（依赖 GameSession 和 User）
    console.log('[6/12] 清空临时事件...');
    const temporaryEventCount = await prisma.temporaryEvent.deleteMany({});
    console.log(`  ✓ 已删除 ${temporaryEventCount.count} 条临时事件记录`);
    totalDeleted += temporaryEventCount.count;

    // 7. 删除玩家行动（依赖 GameSession 和 User）
    console.log('[7/12] 清空玩家行动...');
    const playerActionCount = await prisma.playerAction.deleteMany({});
    console.log(`  ✓ 已删除 ${playerActionCount.count} 条玩家行动记录`);
    totalDeleted += playerActionCount.count;

    // 8. 删除游戏会话（依赖 Room）
    console.log('[8/12] 清空游戏会话...');
    const gameSessionCount = await prisma.gameSession.deleteMany({});
    console.log(`  ✓ 已删除 ${gameSessionCount.count} 条游戏会话记录`);
    totalDeleted += gameSessionCount.count;

    // 9. 删除主机配置（依赖 Room 和 User）
    console.log('[9/12] 清空主机配置...');
    const hostConfigCount = await prisma.hostConfig.deleteMany({});
    console.log(`  ✓ 已删除 ${hostConfigCount.count} 条主机配置记录`);
    totalDeleted += hostConfigCount.count;

    // 10. 删除房间玩家（依赖 Room 和 User）
    console.log('[10/12] 清空房间玩家...');
    const roomPlayerCount = await prisma.roomPlayer.deleteMany({});
    console.log(`  ✓ 已删除 ${roomPlayerCount.count} 条房间玩家记录`);
    totalDeleted += roomPlayerCount.count;

    // 11. 删除房间（依赖 User）
    console.log('[11/12] 清空房间...');
    const roomCount = await prisma.room.deleteMany({});
    console.log(`  ✓ 已删除 ${roomCount.count} 条房间记录`);
    totalDeleted += roomCount.count;

    // 12. 删除用户（最后删除，因为其他表都依赖它）
    console.log('[12/12] 清空用户...');
    const userCount = await prisma.user.deleteMany({});
    console.log(`  ✓ 已删除 ${userCount.count} 条用户记录`);
    totalDeleted += userCount.count;

    console.log('\n========================================');
    console.log('✅ 数据库重置完成！');
    console.log('========================================');
    console.log(`总计删除: ${totalDeleted} 条记录\n`);
    console.log('提示：可以运行 npm run seed 重新填充测试数据\n');

  } catch (error: any) {
    console.error('\n❌ 重置失败:', error.message);
    if (error.code === 'P1001') {
      console.error('   数据库连接失败，请检查 DATABASE_URL 配置');
    } else if (error.code === 'P2003') {
      console.error('   外键约束错误，请检查数据依赖关系');
    }
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// 支持非交互模式（通过环境变量）
if (process.env.FORCE_RESET === 'true') {
  console.log('⚠️  非交互模式：跳过确认，直接清空数据库\n');
  resetDatabase().catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
} else {
  resetDatabase().catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}



