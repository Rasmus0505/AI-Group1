/**
 * 清理 Redis 中的游戏初始化数据
 */

import dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function cleanupRedisInit() {
  console.log('========================================');
  console.log('清理 Redis 游戏初始化数据');
  console.log('========================================\n');

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
  });

  try {
    // 查找所有游戏初始化数据的 key
    const keys = await redis.keys('game:init:*');
    
    if (keys.length === 0) {
      console.log('✓ 没有找到游戏初始化数据');
    } else {
      console.log(`找到 ${keys.length} 个初始化数据:`);
      keys.forEach(key => console.log(`  - ${key}`));
      
      // 删除所有 key
      await redis.del(...keys);
      console.log(`\n✓ 已删除 ${keys.length} 个初始化数据`);
    }

    console.log('\n========================================');
    console.log('清理完成！');
    console.log('========================================');
  } catch (error: any) {
    console.error('❌ 清理失败:', error.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

cleanupRedisInit();
