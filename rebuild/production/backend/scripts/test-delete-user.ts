/**
 * 测试删除用户功能
 * 用于验证删除用户时是否能正确处理外键约束
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

dotenv.config();

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function testDeleteUser() {
  console.log('========================================');
  console.log('测试删除用户功能');
  console.log('========================================\n');

  try {
    // 1. 创建一个测试用户
    console.log('[1/4] 创建测试用户...');
    const testUsername = `test_delete_${Date.now()}`;
    const passwordHash = await bcrypt.hash('Test1234!', 10);

    const testUser = await prisma.user.create({
      data: {
        username: testUsername,
        password: passwordHash,
        nickname: 'Test Delete User',
        status: 'active',
      },
    });
    console.log(`✓ 测试用户已创建: ${testUser.username} (ID: ${testUser.id})\n`);

    // 2. 创建测试房间（该用户作为创建者和房主）
    console.log('[2/4] 创建测试房间...');
    const testRoom = await prisma.room.create({
      data: {
        name: 'Test Room for Deletion',
        creatorId: testUser.id,
        hostId: testUser.id,
        maxPlayers: 4,
        currentPlayers: 1,
        status: 'waiting',
      },
    });
    console.log(`✓ 测试房间已创建: ${testRoom.name} (ID: ${testRoom.id})\n`);

    // 3. 添加用户到房间
    console.log('[3/4] 添加用户到房间...');
    await prisma.roomPlayer.create({
      data: {
        roomId: testRoom.id,
        userId: testUser.id,
        role: 'host',
        status: 'joined',
        isHuman: true,
      },
    });
    console.log('✓ 用户已添加到房间\n');

    // 4. 尝试删除用户（应该能成功，因为我们已经处理了外键约束）
    console.log('[4/4] 测试删除用户...');

    await prisma.$transaction(async (tx) => {
      // 删除房间
      await tx.room.deleteMany({
        where: {
          OR: [
            { creatorId: testUser.id },
            { hostId: testUser.id },
          ],
        },
      });

      // 删除房间参与记录
      await tx.roomPlayer.deleteMany({
        where: { userId: testUser.id },
      });

      // 删除游戏操作记录
      await tx.playerAction.deleteMany({
        where: { userId: testUser.id },
      });

      // 删除临时事件
      await tx.temporaryEvent.deleteMany({
        where: { createdBy: testUser.id },
      });

      // 删除主机配置
      await tx.hostConfig.deleteMany({
        where: { createdBy: testUser.id },
      });

      // 删除用户
      await tx.user.delete({
        where: { id: testUser.id },
      });
    });

    console.log('✓ 用户删除成功！\n');

    // 5. 验证删除
    const deletedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    const deletedRoom = await prisma.room.findUnique({
      where: { id: testRoom.id },
    });

    if (!deletedUser && !deletedRoom) {
      console.log('========================================');
      console.log('✅ 测试通过！用户和房间都已成功删除');
      console.log('========================================');
    } else {
      console.log('========================================');
      console.log('❌ 测试失败！数据未完全删除');
      console.log('========================================');
    }
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    if (error.code === 'P2003') {
      console.error('   错误类型: 外键约束违反');
      console.error('   这说明删除逻辑还需要改进');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDeleteUser().catch((error) => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});

