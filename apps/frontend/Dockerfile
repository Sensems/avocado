FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 复制整个项目
COPY . .

# 安装依赖
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 构建前端产物
RUN pnpm --filter frontend build

# --- Runner ---
FROM nginx:alpine AS runner

# 复制自定义 Nginx 配置
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 从 builder 阶段复制打包出的 dist 静态产物到 Nginx
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
