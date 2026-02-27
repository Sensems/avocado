# Avocado Monorepo

这是一个基于 pnpm Workspaces 搭建的全栈大仓 (Monorepo) 项目。
本项目旨在统一管理和构建 Vue 3 前端应用和 NestJS 后端服务。

## 项目结构 (Project Structure)

```text
avocado/
├── apps/               # 业务应用 (Applications)
│   ├── (待初始化) web  # Vue 3 前端项目
│   └── (待初始化) api  # NestJS 后端项目
├── packages/           # 共享包 (Shared Packages)
│   └── (待初始化)      # 例如：公共组件库、共享类型定义、通用工具函数等
├── package.json        # 根目录依赖及脚本
├── pnpm-workspace.yaml # pnpm 工作区配置
├── tsconfig.base.json  # 基础 TypeScript 配置
└── .prettierrc.json    # 代码格式化规范
```

## 环境要求 (Prerequisites)

- **Node.js**: >= 20.0.0
- **pnpm**: >= 9.0.0

## 核心特性 (Features)

- 📦 **pnpm Workspaces**: 高性能的本地依赖管理
- 🛠 **统一配置**: 在根目录集中管理 TypeScript (`tsconfig.base.json`) 与代码风格 (`.prettierrc.json`) 配置，确保跨项目的一致性
- 🧩 **模块化架构**: 支持在 `packages/` 目录下抽离可复用的业务逻辑和 UI 组件，并在 `apps/` 目录下通过 `@avocado/*` 别名直接引用

## 快速指南 (Quick Guide)

### 安装依赖
```bash
pnpm install
```

### 全局代码格式化
在根目录下执行，将统一格式化大仓下的所有支持的文件：
```bash
pnpm run format
```

## 开发与未来规划 (Development & Roadmap)

目前项目仅包含基础的 Monorepo 骨架，后续步骤：
1. 在 `apps/` 目录下使用 Nest CLI 初始化后端服务。
2. 在 `apps/` 目录下使用 Create Vue 初始化前端应用。
3. （可选）引入构建编排工具如 [Turborepo](https://turbo.build/) 以优化大仓的全量构建与脚本执行速度。
4. 建立 `packages/` 共享库，并通过内部引用相互关联。
