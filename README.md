<p align="center">
  <img src="https://img.shields.io/badge/Avocado-CI/CD-6C3FC5?style=for-the-badge&logo=wechat&logoColor=white" alt="Avocado CI/CD" />
</p>

<h1 align="center">🥑 Avocado</h1>
<p align="center"><strong>开源的微信小程序自动化构建与发布平台</strong></p>
<p align="center">
  <em>Clone → Install → Build → Upload → Preview，一站式全自动完成。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-UNLICENSED-lightgrey" alt="License" />
</p>

---

## 📖 项目简介

**Avocado** 是一个面向前端团队的微信小程序 CI/CD 平台，旨在替代手动的"微信开发者工具上传"流程。通过可视化的 Web 界面，团队可以一键触发构建、自动上传代码到微信后台、生成体验版二维码，并通过 IM 机器人（企业微信、钉钉、飞书）实时推送构建结果。

**核心解决的痛点：**
- ❌ 每次发版都需要打开微信开发者工具手动上传
- ❌ 多人协作时版本号混乱，构建产物无法追溯
- ❌ UniApp 跨框架项目的构建流程复杂且易出错
- ✅ Avocado 让这一切自动化、可追溯、可协作

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx (端口 80)                         │
│                     反向代理 + 静态资源托管                       │
├────────────────────────────┬────────────────────────────────────┤
│     Frontend (Vue 3)       │          API (NestJS 11)           │
│  Naive UI · Tailwind CSS 4 │    Prisma · JWT · BullMQ           │
│  ECharts · xterm · i18n    │    miniprogram-ci · Socket.IO      │
├────────────────────────────┴────────────────────────────────────┤
│                     基础设施层 (Docker)                           │
│          PostgreSQL 15          │         Redis 7                │
│        (数据持久化 + ORM)        │   (任务队列 + 机器人ID池)       │
└─────────────────────────────────┴───────────────────────────────┘
```

### 技术栈一览

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Vue 3 + Composition API | `<script setup lang="ts">` 语法糖 |
| | Naive UI | 企业级 Vue 3 组件库 |
| | Tailwind CSS 4 | 原子化 CSS 框架 |
| | ECharts | 可视化数据图表 (Dashboard) |
| | xterm.js | 浏览器内实时构建终端 |
| | Socket.IO Client | 实时日志推送 / 二维码推送 |
| | Pinia + Persisted State | 状态管理与持久化 |
| | vue-i18n | 国际化 (中文 / English) |
| **后端** | NestJS 11 | 模块化 Node.js 框架 |
| | Prisma 6 | 类型安全的 ORM + 数据库迁移 |
| | BullMQ + Redis | 分布式任务队列 (构建任务调度) |
| | miniprogram-ci | 微信小程序 CI SDK (上传/预览) |
| | Passport + JWT | 身份认证与鉴权 |
| | Socket.IO Server | WebSocket 实时通信 |
| | Swagger | API 文档自动生成 |
| **基础设施** | PostgreSQL 15 | 主数据库 |
| | Redis 7 | 消息队列 + 机器人 ID 池 |
| | Docker Compose | 一键容器化部署 |
| | GitHub Actions | CI/CD 镜像自动构建与发布 |

### 项目目录结构

```text
avocado/
├── apps/
│   ├── api/                    # NestJS 后端服务
│   │   ├── prisma/             # Prisma Schema + 迁移文件 + Seed
│   │   ├── src/
│   │   │   ├── common/         # 公共模块 (Prisma, 加密工具, Git认证)
│   │   │   └── modules/
│   │   │       ├── auth/       # JWT 认证模块
│   │   │       ├── users/      # 用户管理模块
│   │   │       ├── projects/   # 项目 CRUD 模块
│   │   │       ├── build/      # 构建核心模块
│   │   │       │   ├── build-tasks/   # 构建任务 (Controller/Service/Processor)
│   │   │       │   ├── robot-pool/    # 机器人 ID 资源池
│   │   │       │   └── artifacts/     # 构建产物管理
│   │   │       ├── resources/  # 资源管理模块
│   │   │       │   ├── git-credentials/  # Git 凭证管理
│   │   │       │   ├── im-robots/        # IM 通知机器人
│   │   │       │   └── audit-logs/       # 操作审计日志
│   │   │       ├── dashboard/  # 仪表盘数据聚合
│   │   │       └── ws/         # WebSocket 网关
│   │   ├── Dockerfile          # 后端生产镜像
│   │   └── entrypoint.sh       # 容器启动脚本 (自动迁移+种子)
│   │
│   └── frontend/               # Vue 3 前端应用
│       ├── src/
│       │   ├── views/
│       │   │   ├── login/      # 登录页
│       │   │   ├── dashboard/  # 仪表盘 (ECharts 数据可视化)
│       │   │   ├── projects/   # 项目列表 + 项目详情
│       │   │   ├── admin/      # 管理后台
│       │   │   │   ├── users/       # 用户管理
│       │   │   │   ├── credentials/ # Git 凭证管理
│       │   │   │   ├── robots/      # IM 机器人管理
│       │   │   │   └── audit-logs/  # 审计日志查看
│       │   │   └── error/      # 403 等错误页
│       │   ├── api/            # Axios API 层
│       │   ├── i18n/           # 国际化资源
│       │   ├── store/          # Pinia Store
│       │   ├── router/         # Vue Router
│       │   └── layout/         # 全局布局
│       ├── Dockerfile          # 前端 Nginx 生产镜像
│       └── nginx.conf          # Nginx 反向代理配置
│
├── packages/                   # 共享包 (预留)
├── docker-compose.yml          # 开发环境编排
├── docker-compose.prod.yml     # 生产环境编排
├── .env.example                # 环境变量模板
├── .github/workflows/          # GitHub Actions CI/CD
├── pnpm-workspace.yaml         # pnpm Monorepo 配置
└── tsconfig.base.json          # 基础 TypeScript 配置
```

---

## ✅ 已实现功能 (v1.0)

### 🔐 认证与权限
- [x] JWT Token 认证 (登录 / 注销)
- [x] 超级管理员 (SuperAdmin) 角色体系
- [x] 前端路由守卫，管理页面自动拦截非管理员访问
- [x] 登录状态持久化 (Pinia Persisted State)

### 📦 项目管理
- [x] 项目 CRUD (名称、AppID、仓库地址、框架类型)
- [x] 支持 `native` (原生小程序) 和 `uniapp` 两种框架类型
- [x] 项目级构建命令 & 产物路径自定义
- [x] 项目成员管理 (maintainer / developer / guest 角色)
- [x] 项目级默认分支配置
- [x] 私钥文件上传与管理

### 🔨 自动化构建
- [x] **一键触发构建**：选择分支 + 版本号，自动完成 Clone → Install → Build → Upload → Preview 全流程
- [x] **Git Webhook 触发**：配置 Webhook URL 和 Secret，支持 Push 事件自动触发构建
- [x] **分支过滤**：Webhook 触发时仅匹配项目设置的默认分支
- [x] **版本号自动递增**：基于 SemVer 规范自动 Bump Patch 版本
- [x] **智能包管理器检测**：自动识别 pnpm / yarn / npm，无需手动配置
- [x] **Git 凭证认证**：支持 SSH 密钥 / HTTPS 密码 / PAT (Personal Access Token) 三种认证方式
- [x] **miniprogram-ci 集成**：自动调用微信小程序 CI SDK 上传代码并生成体验版二维码
- [x] **BullMQ 任务队列**：异步调度构建任务，支持并发控制
- [x] **机器人 ID 池**：通过 Redis 管理 1~30 号上传机器人，防止并发冲突

### 📺 实时构建终端
- [x] 基于 **xterm.js** 的浏览器内实时终端
- [x] 通过 **Socket.IO** 推送构建日志流 (stdout / stderr)
- [x] 构建完成后实时推送体验版二维码到终端界面

### 📋 历史版本管理
- [x] 构建产物 ZIP 归档保存
- [x] 历史版本列表 (状态、版本号、分支、触发人、时间)
- [x] **历史版本快速上传**：从已归档的构建产物直接重新上传到微信后台
- [x] 构建产物保留策略 (Retention Count)，自动清理超出数量的旧产物
- [x] 历史版本删除（含二次确认）

### 📊 数据仪表盘
- [x] 基于 **ECharts** 的可视化数据面板
- [x] 项目总数、构建总数、成功率等关键指标统计
- [x] 构建趋势图、状态分布图

### 🔔 IM 通知集成
- [x] 支持**企业微信**、**钉钉**、**飞书**三大平台的 Webhook 机器人通知
- [x] 构建开始 / 成功 / 失败 全生命周期自动推送
- [x] 成功通知附带体验版二维码图片

### ⚙️ 系统管理 (Admin)
- [x] 用户管理 (CRUD、启用/禁用)
- [x] Git 凭证管理 (SSH / HTTPS / PAT，AES 加密存储)
- [x] IM 机器人管理 (企业微信 / 钉钉 / 飞书)
- [x] 操作审计日志 (记录关键操作的变更详情)

### 🐳 部署与运维
- [x] Docker Compose 一键部署 (PostgreSQL + Redis + API + Frontend)
- [x] GitHub Actions CI/CD 自动构建和推送 Docker 镜像到 GHCR
- [x] 容器启动时自动执行 Prisma 数据库迁移
- [x] 初始管理员账号自动注入 (Seed)
- [x] Nginx 反向代理，前后端统一入口
- [x] 跨平台构建兼容 (Windows / Linux)

### 🌐 其他
- [x] 国际化支持 (中文 / English)
- [x] 暗色主题 UI
- [x] Swagger API 文档 (`/api/docs`)

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本要求 |
|------|---------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.0.0 |
| PostgreSQL | >= 15 |
| Redis | >= 7 |

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/Sensems/avocado.git avocado && cd avocado

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接信息等

# 4. 数据库迁移
cd apps/api
npx prisma migrate deploy
npx prisma db seed
cd ../..

# 5. 启动后端 (端口 3000)
pnpm --filter @avocado/api run start:dev

# 6. 启动前端 (端口 5173)
pnpm --filter frontend run dev
```

### Docker 一键部署 (推荐)

本项目支持无需本地构建的"真正一键部署"。镜像已预编译并发布在 GitHub Packages (GHCR)。

```bash
# 1. 新建目录并下载配置文件
mkdir avocado && cd avocado
wget https://raw.githubusercontent.com/sensems/avocado/main/docker-compose.prod.yml -O docker-compose.yml
wget https://raw.githubusercontent.com/sensems/avocado/main/.env.example -O .env

# 2. (可选) 修改 .env 中的密码和端口配置

# 3. 一键启动
docker-compose up -d
```

> **初次启动时**，后端容器会自动执行 Prisma 数据库迁移和管理员账号初始化。

**默认管理账号：**
| 字段 | 值 |
|------|----|
| 用户名 | `admin` |
| 密码 | `123456` (可通过 `.env` 中 `ADMIN_DEFAULT_PASSWORD` 修改) |

启动后访问 `http://localhost` 即可使用。

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `POSTGRES_USER` | PostgreSQL 用户名 | `root` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | `password` |
| `POSTGRES_DB` | 数据库名 | `avocado` |
| `DATABASE_URL` | Prisma 数据库连接串 | 自动拼接 |
| `REDIS_HOST` | Redis 地址 | `redis` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `JWT_SECRET` | JWT 签名密钥 | `super-secret-key-change-me` |
| `API_BASE_URL` | API 对外基础 URL | `http://localhost:3000` |
| `ADMIN_DEFAULT_PASSWORD` | 初始管理员密码 | `123456` |

---

## 🗺️ Roadmap (v2.0 迭代计划)

### 多平台小程序支持
- [ ] 数据模型增加 `PlatformType` 枚举 (wechat / alipay / bytedance)
- [ ] 支付宝小程序 CI 集成 (`minidev` / `@alipay/miniapp-cli`)
- [ ] 字节跳动 (抖音) 小程序 CI 集成 (`tt-ide-cli`)
- [ ] 前端创建项目时支持选择目标平台，动态切换表单字段
- [ ] UniApp 项目根据目标平台智能切换构建命令 (如 `build:mp-alipay`, `build:mp-toutiao`)

### Pipeline as Code (流水线即代码)
- [ ] 支持项目根目录 `avocado.yml` 自定义流水线阶段 (lint → test → build → deploy → notify)
- [ ] 可视化流水线编排界面 (拖拽式 Pipeline Editor)
- [ ] 系统不再局限于"打包小程序"，可扩展为通用 CI/CD 平台

### 分布式构建集群 (Worker Node)
- [ ] 将构建执行器剥离为独立的 `Avocado Runner` 进程/容器
- [ ] Runner 通过 WebSocket 或 gRPC 与主服务连接，接受任务调度
- [ ] 基于 Docker 容器隔离构建环境，解决不同项目的 Node.js 版本冲突
- [ ] 支持 Runner 水平扩容 (Scale-out)

### 多环境发布与审批流
- [ ] 多环境概念 (Development → Staging → Production)
- [ ] 生产环境发布前的审批流 (Approval Flow)
- [ ] 审批通知推送到 IM 机器人，主管一键审批

### 插件化架构 (Plugin System)
- [ ] 定义标准插件接口 (上传、通知、清理等)
- [ ] 插件市场 / 插件注册机制
- [ ] 内置插件：微信上传、支付宝上传、字节上传、OSS 上传、CDN 刷新等

### 研发效能度量 (DORA Metrics)
- [ ] 发布频率 (Deployment Frequency) 统计
- [ ] 构建耗时分布 (Lead Time) 分析
- [ ] 变更失败率 (Change Failure Rate) 看板
- [ ] 故障恢复时长 (MTTR) 跟踪

### 更多能力扩展
- [ ] 一键版本回滚 (从历史产物快速恢复)
- [ ] 构建缓存 (`node_modules` / 构建产物缓存加速)
- [ ] 邮件通知渠道
- [ ] RBAC 细粒度权限控制 (项目级 + 操作级)
- [ ] SSO / LDAP / OAuth 2.0 第三方登录集成
- [ ] 多语言扩展 (日语、韩语等)
- [ ] 浅色主题适配优化

---

## 📄 License

UNLICENSED - 本项目为私有项目。
