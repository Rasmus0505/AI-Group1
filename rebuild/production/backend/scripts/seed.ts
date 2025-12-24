/**
 * Database Seeding Script
 * Creates sample test data for development environment
 * 
 * Usage: npm run seed
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...\n');

  // 1. Ensure default developer account exists
  // We hardcode 'developer' to ensure cross-environment consistency
  const adminUsername = 'developer';
  const adminPassword = '000000';
  // Check by username only
  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        username: adminUsername,
        password: passwordHash,
        nickname: '系统管理员',
        status: 'active',
      },
    });
    console.log(`✓ Default developer account created: ${adminUsername} / ${adminPassword}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        username: adminUsername,
        password: passwordHash,
        nickname: '系统管理员',
        status: 'active'
      }
    });
    console.log(`✓ Default developer account synced/verified: ${adminUsername} (ID: ${existingAdmin.id})`);
  }

  // 2. Create sample test users
  const testUsers = [
    { username: 'testuser1', password: 'Test1234!', nickname: 'Test User 1' },
    { username: 'testuser2', password: 'Test1234!', nickname: 'Test User 2' },
    { username: 'testuser3', password: 'Test1234!', nickname: 'Test User 3' },
    { username: 'demo_player', password: 'demo123', nickname: 'Demo Player' },
  ];

  let createdUsers = 0;
  for (const userData of testUsers) {
    const existing = await prisma.user.findFirst({ where: { username: userData.username } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      await prisma.user.create({
        data: {
          username: userData.username,
          password: passwordHash,
          nickname: userData.nickname,
          status: 'active',
        },
      });
      createdUsers++;
    }
  }
  console.log(`✓ Created ${createdUsers} test users (${testUsers.length - createdUsers} already existed)`);

  // 3. Create sample rooms (if we have users)
  const allUsers = await prisma.user.findMany({ take: 5 });
  if (allUsers.length > 0) {
    const hostUser = allUsers[0];

    // Create a few sample rooms
    const sampleRooms = [
      { name: 'Welcome Room', maxPlayers: 4, status: 'waiting' as const },
      { name: 'Practice Room', maxPlayers: 6, status: 'waiting' as const },
      { name: 'Competitive Room', maxPlayers: 4, status: 'waiting' as const },
    ];

    let createdRooms = 0;
    for (const roomData of sampleRooms) {
      const existing = await prisma.room.findFirst({
        where: { name: roomData.name, creatorId: hostUser.id }
      });

      if (!existing) {
        const room = await prisma.room.create({
          data: {
            name: roomData.name,
            maxPlayers: roomData.maxPlayers,
            currentPlayers: 1,
            status: roomData.status,
            creatorId: hostUser.id,
            hostId: hostUser.id,
          },
        });

        // Add host as player
        await prisma.roomPlayer.create({
          data: {
            roomId: room.id,
            userId: hostUser.id,
            role: 'host',
            status: 'joined',
            isHuman: true,
          },
        });

        createdRooms++;
      }
    }
    console.log(`✓ Created ${createdRooms} sample rooms (${sampleRooms.length - createdRooms} already existed)`);

    // 4. Create sample HostConfig for the first room
    const firstRoom = await prisma.room.findFirst({ where: { name: 'Welcome Room' } });
    if (firstRoom) {
      // 4a. Create GameSession first (Tasks depend on it via FK)
      let session = await prisma.gameSession.findUnique({ where: { roomId: firstRoom.id } });
      if (!session) {
        session = await prisma.gameSession.create({
          data: {
            roomId: firstRoom.id,
            currentRound: 1,
            status: 'playing',
          }
        });
        console.log(`✓ Created GameSession for "${firstRoom.name}"`);
      }

      // 4b. HostConfig
      const existingConfig = await prisma.hostConfig.findUnique({ where: { roomId: firstRoom.id } });
      if (!existingConfig) {
        await prisma.hostConfig.create({
          data: {
            roomId: firstRoom.id,
            createdBy: firstRoom.hostId,
            apiProvider: 'deepseek',
            apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
            apiHeaders: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer sk-YOUR-KEY-HERE'
            },
            apiConfig: { provider: 'deepseek' },
            apiBodyTemplate: {
              model: 'deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content: '你是一个游戏推演引擎，根据玩家的决策和游戏规则，生成游戏剧情和结果。'
                },
                {
                  role: 'user',
                  content: '{{prompt}}'
                }
              ],
              temperature: 0.7,
              max_tokens: 2000,
              stream: true
            },
            gameRules: `# 末日生存：废土之王\n\n**背景**：2050年，资源枯竭。\n**规则**：\n1. 每回合提交一项决策。\n2. 决策影响生命值、食物和金钱。\n3. 支持玩家间交易。`,
            totalDecisionEntities: 4,
            humanPlayerCount: 1,
            aiPlayerCount: 3,
            decisionTimeLimit: 120,
            timeoutStrategy: 'auto_submit',
            initializationCompleted: true,
          }
        });
        console.log(`✓ Created sample game configuration for "${firstRoom.name}"`);

        // 5. Create some sample tasks (Now FK is valid)
        const sampleTasks = [
          { title: '资源收集者', description: '在本局游戏中收集100个单位的食物', taskType: 'main', difficulty: 'normal' },
          { title: '和平主义者', description: '连续3回合不发起任何冲突', taskType: 'challenge', difficulty: 'hard' }
        ];

        for (const tData of sampleTasks) {
          await prisma.task.create({
            data: {
              sessionId: session.id, // Correct FK
              title: tData.title,
              description: tData.description,
              taskType: tData.taskType,
              difficulty: tData.difficulty,
              requirements: { target: 100 },
              createdBy: hostUser.id,
              status: 'active',
              progress: {}
            }
          });
        }
        console.log(`✓ Created sample tasks`);
      }

      // 6. Create sample strategy for test user
      await prisma.strategy.create({
        data: {
          userId: hostUser.id,
          strategyName: '防御均衡流',
          description: '优先保障食物储备，次要发展防御体系。',
          strategyData: { preference: 'defense', aggressiveness: 0.2 },
          winRate: 0.75,
          averageScore: 850,
          totalGames: 12,
          totalWins: 9,
        }
      });
      console.log(`✓ Created sample strategy for user`);
    }
  }

  console.log('\n✅ Database seeding completed!');
  console.log('\n📝 Test Accounts:');
  console.log('   Developer Account: developer / 000000');
  console.log('   Test User 1:       testuser1 / Test1234!');
  console.log('   Test User 2:       testuser2 / Test1234!');
  console.log('   Test User 3:       testuser3 / Test1234!');
  console.log('   Demo Player:       demo_player / demo123');
  console.log('\n🔑 Developer Code: wskfz (for admin panels)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

