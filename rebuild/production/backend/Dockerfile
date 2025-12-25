# 多阶段构建 - 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache libc6-compat

# 复制 package 文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖（包括 devDependencies，用于构建）
RUN npm ci

# 生成 Prisma Client
RUN npx prisma generate

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 安装运行时依赖
RUN apk add --no-cache \
    wget \
    dumb-init

# 复制 package 文件
COPY package*.json ./
COPY prisma ./prisma/

# 只安装生产依赖
RUN npm ci --only=production && \
    npm cache clean --force

# 生成 Prisma Client（生产环境）
RUN npx prisma generate

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 创建日志目录
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# 使用 dumb-init 处理信号
ENTRYPOINT ["dumb-init", "--"]

# 启动服务器
CMD ["node", "dist/server.js"]

