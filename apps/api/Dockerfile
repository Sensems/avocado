FROM node:20-alpine AS builder

# 启用 corepack 以使用 pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# bcrypt 等原生模块需要编译工具链
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制整个项目 (配合 .dockerignore 忽略无关文件)
COPY . .

# 安装依赖
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 生成 Prisma 客户端并构建后端
WORKDIR /app/apps/api
RUN npx prisma generate
RUN pnpm run build

# 验证构建产物存在
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found after build!" && exit 1)

# 利用 pnpm 隔离生产依赖
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @avocado/api --prod deploy --legacy /prod/api

# --- Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

# 1. 先复制 pnpm deploy 的生产依赖 (node_modules + package.json)
COPY --from=builder /prod/api/node_modules ./node_modules
COPY --from=builder /prod/api/package.json ./package.json

# 2. 复制构建产物 (直接从 builder 源路径复制，不依赖 pnpm deploy)
COPY --from=builder /app/apps/api/dist ./dist

# 3. 复制 Prisma schema 和迁移文件
COPY --from=builder /app/apps/api/prisma ./prisma

# 4. 复制启动脚本
COPY apps/api/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# 全局安装 prisma CLI (锁定与项目一致的 v6 版本，v7 有破坏性变更)
RUN npm install -g prisma@6

# 重新生成 Prisma Client，确保路径与 pnpm deploy 的 node_modules 结构匹配
RUN prisma generate --schema=./prisma/schema.prisma

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["sh", "./entrypoint.sh"]
