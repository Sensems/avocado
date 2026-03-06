FROM node:20-alpine AS builder

# 启用 corepack 以使用 pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 复制整个项目 (配合 .dockerignore 忽略无关文件)
COPY . .

# 安装依赖
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 生成 Prisma 客户端并构建后端
WORKDIR /app/apps/api
RUN npx prisma generate
RUN pnpm run build

# 利用 pnpm 隔离生产依赖
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @avocado/api --prod deploy --legacy /prod/api

# 确保 Prisma Client 被复制过来 (如果它生成在应用内的 node_modules)
RUN cp -R /app/apps/api/node_modules/.prisma /prod/api/node_modules/ || true
RUN cp -R /app/node_modules/.prisma /prod/api/node_modules/ || true

# --- Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

# 复制独立出来的生产环境代码和 npm 依赖
COPY --from=builder /prod/api ./
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY apps/api/entrypoint.sh ./

RUN chmod +x ./entrypoint.sh

# 全局安装 prisma CLI (锁定与项目一致的 v6 版本，v7 有破坏性变更)
RUN npm install -g prisma@6

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["sh", "./entrypoint.sh"]
