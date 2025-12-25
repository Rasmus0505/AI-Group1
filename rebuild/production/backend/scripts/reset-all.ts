import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('清理会话和重置房间...');
  
  // 查看所有会话
  const sessions = await prisma.gameSession.findMany();
  console.log('当前会话:', sessions.length);
  sessions.forEach(s => console.log('  -', s.id, s.status, s.roomId));
  
  // 删除所有会话
  if (sessions.length > 0) {
    await prisma.gameSession.deleteMany();
    console.log('已删除所有会话');
  }
  
  // 重置房间状态
  const result = await prisma.room.updateMany({
    data: { status: 'waiting', startedAt: null, finishedAt: null }
  });
  console.log('已重置', result.count, '个房间状态为 waiting');
  
  await prisma.$disconnect();
  console.log('完成！');
}

main();
