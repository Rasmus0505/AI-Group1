/**
 * 数据库连接诊断脚本
 * 用于检查数据库配置和连接状态
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function checkDatabase() {
  console.log('========================================');
  console.log('数据库连接诊断');
  console.log('========================================\n');

  // 1. 检查环境变量
  console.log('1. 检查环境变量...');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('   ✗ DATABASE_URL 未设置');
    console.error('   请在 .env 文件中设置 DATABASE_URL');
    process.exit(1);
  } else {
    // 隐藏密码显示
    const maskedUrl = databaseUrl.replace(/:(.*)@/, ':****@');
    console.log(`   ✓ DATABASE_URL 已设置: ${maskedUrl}`);
  }
  console.log('');

  // 2. 尝试连接数据库
  console.log('2. 尝试连接数据库...');
  try {
    await prisma.$connect();
    console.log('   ✓ 数据库连接成功');
  } catch (error: any) {
    console.error('   ✗ 数据库连接失败');
    console.error(`   错误代码: ${error.code || 'UNKNOWN'}`);
    console.error(`   错误信息: ${error.message}`);
    
    if (error.code === 'P1001') {
      console.error('\n   可能的原因:');
      console.error('   - PostgreSQL 服务未运行');
      console.error('   - DATABASE_URL 中的主机地址或端口不正确');
      console.error('   - 防火墙阻止了连接');
      console.error('\n   解决方案:');
      console.error('   1. 检查 PostgreSQL 是否运行: docker ps 或检查服务状态');
      console.error('   2. 检查 DATABASE_URL 配置是否正确');
      console.error('   3. 尝试手动连接: psql -h localhost -U postgres');
    } else if (error.code === 'P1003') {
      console.error('\n   可能的原因:');
      console.error('   - 数据库不存在');
      console.error('   - DATABASE_URL 中的数据库名称不正确');
      console.error('\n   解决方案:');
      console.error('   1. 创建数据库: CREATE DATABASE your_database_name;');
      console.error('   2. 或修改 DATABASE_URL 中的数据库名称');
    } else if (error.code === 'P1000') {
      console.error('\n   可能的原因:');
      console.error('   - 数据库认证失败');
      console.error('   - 用户名或密码不正确');
      console.error('\n   解决方案:');
      console.error('   1. 检查 DATABASE_URL 中的用户名和密码');
      console.error('   2. 确认数据库用户有足够的权限');
    }
    
    process.exit(1);
  }
  console.log('');

  // 3. 检查数据库表
  console.log('3. 检查数据库表...');
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;
    
    if (tables.length === 0) {
      console.log('   ⚠ 数据库中没有表');
      console.log('   请运行数据库迁移: npm run prisma:migrate');
    } else {
      console.log(`   ✓ 找到 ${tables.length} 个表:`);
      tables.forEach(table => {
        console.log(`      - ${table.tablename}`);
      });
    }
  } catch (error: any) {
    console.error(`   ✗ 查询表失败: ${error.message}`);
  }
  console.log('');

  // 4. 测试查询
  console.log('4. 测试查询...');
  try {
    const userCount = await prisma.user.count();
    console.log(`   ✓ 查询成功，用户表中有 ${userCount} 条记录`);
  } catch (error: any) {
    if (error.code === 'P2021') {
      console.error('   ✗ 表不存在');
      console.error('   请运行数据库迁移: npm run prisma:migrate');
    } else {
      console.error(`   ✗ 查询失败: ${error.message}`);
    }
  }
  console.log('');

  console.log('========================================');
  console.log('诊断完成');
  console.log('========================================');

  await prisma.$disconnect();
}

checkDatabase().catch((error) => {
  console.error('诊断脚本执行失败:', error);
  process.exit(1);
});

