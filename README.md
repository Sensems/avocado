# Avocado

微信小程序私有化 CI/CD 平台：Clone → Install → Build → Upload → Preview 全链路自动化，带 Web 界面、多项目管理、项目级权限、IM 通知、构建产物归档与操作审计。

> **这是一份归档交接文档**，最后更新 2026-11-19。项目已停止迭代：功能代码停在 `5e029d5`，其后的提交仅为归档文档与已重置旧密钥的清理（以 `git log` 为准），工作区干净、可直接复用。
> 只想快速回忆：读「三分钟速览」「架构说明」「重新跑起来」「已知边界」四节即可。

---

## 三分钟速览

| 项 | 内容 |
|---|---|
| 定位 | 给团队用的「平台」，不是 CLI 工具：Web 界面 + 多项目 + 权限 + 审计 + 微信上传 |
| 技术栈 | NestJS 11 + Prisma 6 + PostgreSQL + Redis + BullMQ / Vue 3 + Naive UI + ECharts + xterm.js |
| 状态 | **停止迭代（2026-11-19）**；功能完整、可运行；功能最后提交 `5e029d5`，其后均为归档收尾提交 |
| 验证程度 | 真实微信上传链路已跑通（上传 → 体验版二维码 → 产物归档）；68 条端到端用例，发现 12 个缺陷并全部修复；6 个 spec 文件的单元测试 |
| 停止原因 | 市面同类都是 SDK / CLI / 构建插件，没有「带 Web 界面的团队级平台」——可能是真实空白，也可能是伪需求。技术目标已达成，但未继续去找第一个真实用户 |
| 第一优先级风险 | 两把微信上传密钥曾进入**公开仓库的 git 历史**：已在微信后台重置、文件已删除，但历史尚未清理 |

---

## 一、项目总结

### 1.1 原本要解决什么

- 每次发版都要打开微信开发者工具手动上传，密钥散落在开发者电脑里
- 多人协作时版本号混乱、体验版互相覆盖、构建产物无法追溯
- UniApp / 原生小程序的构建流程各自为政，缺少统一入口和结果通知

### 1.2 实际交付了什么

| 能力域 | 交付内容 |
|---|---|
| 认证与权限 | JWT 登录、超管体系、项目级角色（maintainer / developer / guest）、`ProjectGuard` 按 `:id` / `:taskId` 反查项目校验、前端路由守卫 |
| 项目管理 | CRUD、native / uniapp 框架、自定义构建命令与产物路径、默认分支、Webhook 密钥、私钥文件、成员管理、**软删除** |
| 资源与密钥 | Git 凭证（ssh / https / pat，AES 加密）、IM 机器人（企微 / 钉钉 / 飞书）、凭证连接测试与分支列举、项目表单内快速添加弹框 |
| 构建流水线 | 手动 / Webhook 触发，BullMQ 队列（并发 3、重试 2 次、指数退避），clone → 依赖缓存 → 构建 → `miniprogram-ci` 上传 → 二维码 → 产物 ZIP 归档 |
| 并发与稳定性 | Redis 机器人 ID 池（1–30，启动从 DB 重建）、pending→running 乐观锁幂等、任务取消 / 重试 / 历史重传、僵死任务回收、每日清理过期日志与二维码 |
| 可观测与审计 | xterm.js 实时终端 + Socket.IO 日志流、历史日志回补、ECharts 仪表盘（趋势 / 状态 / 框架分布）、审计日志、中英双语、暗色主题、Swagger |
| 安全 | 二维码与产物 ZIP 的 HMAC 签名 URL（默认 7 天有效）、日志移出 `public` 走鉴权接口、分支白名单防命令注入、全局异常过滤与统一响应包装 |
| 部署 | Docker Compose（Postgres / Redis / API / 前端 Nginx）、GHCR 镜像与 GitHub Actions、启动自动迁移 + seed |

### 1.3 验证到什么程度

- `document/TEST-REPORT-2026-11-18.md`：**68 条用例**（认证、权限矩阵、构建、日志/产物、仪表盘、审计、i18n、安全），52 条通过、7 条修复后复测通过、9 条因缺少前置资源未执行
- 首次跑通真实微信上传：项目 `story-collection`（Gitee / master / 源码在子目录）→ `success`、机器人 18 号、包体积 165561 字节、40 位 commitHash、签名二维码正常渲染
- 12 个缺陷含 4 个 P0：产物 ZIP 裸奔泄露源码、`create()` 丢弃 `distPath`/`buildCommand`、PUT 用 `?? null` 清空 `appId`、机器人表单字段名 `secret` ≠ 后端 `secretToken` 导致 100% 400；另有 `ProjectGuard` fail-open 造成越权
- 此后按用户反馈继续修完：删除外键 RESTRICT 抛 500 → 409 友好提示、`native` 未 i18n、历史日志不显示二维码、软删除项目占用凭证导致无法删除等
- 详细用例清单见 `document/TEST-CASES.md`（90 条），重构记录见 `document/REFACTOR-PLAN.md`

### 1.4 为什么停

搜过同类项目后结论是：官方 `miniprogram-ci` 是 SDK，`uni-mini-ci` / `mini-ci` 是 CLI，`vite-plugin-uni-mini-ci` 是构建插件，**没有一个做成了带 Web 界面、多用户、权限、审计的私有化平台**。

这个「独一份」有两种解释：真实空白，或者伪需求——对个人发版来说，GitHub Actions + 一个 `upload.js` + Secrets 里的密钥五分钟就够，没人愿意为它部署一套 NestJS + Postgres + Redis。平台只在「一个团队、多项目、多人并发、要审计」时才成立，而这一步需要先找到真实用户，不是继续加功能。

**结论：技术价值已经拿满，产品价值未验证，因此不再投入。** 代码与这一轮踩过的坑，留作以后做团队级工具的起点。

---

## 二、架构说明

### 2.1 部署形态

```
                     浏览器
                       |
        Frontend  Vue3 :5173(dev) / :80(Nginx 容器)
                       |  /api/*  +  Socket.IO
        API       NestJS :3000  (全局前缀 /api，Swagger /api/docs)
          |          |            |             |
      Prisma      BullMQ       /storage      WS Gateway
          |          |        (签名静态资源)   (Redis Adapter)
    PostgreSQL    Redis      public/storage   var/logs
    (业务数据)  (队列/机器人池)  (二维码/产物ZIP) (日志，不公开)
```

`docker-compose.yml` / `.prod.yml` 编排 4 个服务：postgres、redis、api、frontend。本地开发是裸进程（见 2.9），不依赖 Docker。

### 2.2 两条主链路

**HTTP 请求链路**
`Vue → /api/* → JwtAuthGuard → RolesGuard（超管接口）/ ProjectGuard（项目接口）→ Controller → Service → Prisma → TransformInterceptor 统一包装 { code, message, data } → HttpExceptionFilter 透出校验错误`

**构建链路**（`BuildJobProcessor`，并发 3）
1. `POST /api/build-tasks/trigger` 或 `POST /api/build-tasks/webhook/:projectId`（HMAC 校验 + 默认分支匹配）→ 先做分支白名单校验，再落 `BuildTask(pending)` 并入队
2. Worker 取任务：幂等检查（只处理 pending）→ 从 Redis 池 `SPOP` 一个机器人 ID；取不到则 `moveToDelayed` + `DelayedError` 10 秒后重试
3. 乐观锁 `pending → running` → `BuildRunner` 克隆 / 装依赖（命中 `var/cache`）/ 执行构建命令
4. `MiniprogramUploader` 调 `miniprogram-ci` 上传 → 生成体验版二维码 → `ArtifactsService` 归档 ZIP
5. 全程 `emitLog` 经 Socket.IO 推到 xterm 终端；`BuildNotifier` 推「开始 / 成功（带二维码）/ 失败」到项目绑定的 IM 机器人；`AuditLogInterceptor` 记录关键操作
6. `finally` 归还机器人 ID，更新 `status` / `commitHash` / `packageSize` / `failReason`

### 2.3 后端模块地图

| 模块 | 路径 | 主要路由 / 职责 |
|---|---|---|
| auth / users | `modules/auth`, `modules/users` | `/auth/login`, `/auth/profile`；用户 CRUD、启用禁用 |
| projects | `modules/projects/project-core` | `/projects`（含成员管理、软删除） |
| resources | `modules/resources/*` | `/git-credentials`（含 `list-branches`、`test`）、`/im-robots`（含 `test`）、`/audit-logs` |
| build | `modules/build/build-tasks` | `/build-tasks`（trigger / 列表 / log / cancel / retry / reupload / webhook） |
| build 支撑 | `build-job.processor`、`build-runner`、`miniprogram-uploader`、`build-notifier`、`robot-pool`、`artifacts` | 队列消费、克隆构建、微信上传、通知、ID 池、产物归档 |
| ws / dashboard | `modules/ws`, `modules/dashboard` | 日志与二维码实时推送；`/dashboard/stats` 聚合 |
| common | `common/*` | Prisma、JWT/Roles/Project 守卫、审计与响应拦截器、异常过滤、AES 加密、HMAC 签名、分支校验、Git 认证 |

### 2.4 数据模型（`apps/api/prisma/schema.prisma`）

8 个 model：`User`、`Project`、`ProjectMember`、`ProjectImRobot`、`GitCredential`、`ImRobot`、`BuildTask`、`AuditLog`；枚举 `GlobalStatus`、`ProjectRole`、`FrameworkType`、`GitCredentialType`、`ImPlatform`、`TaskStatus`。

三条容易忘的语义：

- **软删除**：`Project.deletedAt` 只做标记（物理删会级联删光构建历史），删除时给 `name` 加 `__deleted_<ts>` 后缀释放唯一约束，并把 `gitCredentialId` 置 null 释放凭证
- **凭证可空**：`gitCredentialId String?` + 外键 `ON DELETE SET NULL`（migration `20261118184500_make_git_credential_nullable`）；公开仓库不需要凭证，删凭证时只拦有效项目
- **`logPath` 只存文件名** `build-<taskId>.log`；失败原因单独放 `failReason`，等待机器人等提示走日志通道，不再塞进路径字段

迁移目录 `apps/api/prisma/migrations/` 共 9 个，从 `0_init` 到 `make_git_credential_nullable`。注意 `0_init/migration.sql` 曾因 UTF-16 LE BOM 导致 Prisma 报 `embedded null`，已转 UTF-8。

### 2.5 权限模型

| 操作 | maintainer | developer | guest | 项目外用户 |
|---|---|---|---|---|
| 项目详情 / 构建历史 | 允许 | 允许 | 允许（读） | 403 |
| 触发构建 / 重试 / 取消 | 允许 | 允许 | 禁止 | 403 |
| 改设置 / 删项目 / 管理成员 | 允许 | 403 | 403 | 403 |
| 用户 / 凭证 / 机器人 / 审计管理 | 仅超管（全局），超管跳过项目角色检查 | | | |

`ProjectGuard` 从 `:projectId`、`:id`、body、query 取项目 ID；任务级路由只有 `:taskId` 时反查 `BuildTask.projectId`。**注意：测试报告里「构建日志」一项 guest 返回 200，标注为未复验项**，见 3.4。

### 2.6 关键设计决策（踩过的坑，最值得复用）

| 决策 | 为什么 |
|---|---|
| 项目软删除 + name 加后缀 | 物理删会级联删掉所有构建历史；唯一约束会挡住同名重建 |
| `gitCredentialId` 可空 + FK `SET NULL` | DTO 本就可选，schema 却是 NOT NULL；软删除项目长期占着凭证导致删不掉（P2003 → 500） |
| 更新字段用 `!== undefined` | `?? null` 会在「只改构建命令」时静默清空 `appId` / `defaultBranch` / 凭证（数据丢失） |
| 二维码与产物 ZIP 走 HMAC 签名 URL | 任务 ID 自增可枚举，ZIP 里是完整源码（含 node_modules）；IM 机器人要免登录拉图，用 `path:exp` 签名 + 7 天过期折中 |
| 校验签名用**完整路径** | 用 `basename(req.path)` 会丢掉 `/artifacts/` 子目录，导致合法签名恒 403 |
| 日志不落 `public` | 日志含仓库地址、分支、依赖输出，走鉴权接口 `GET /build-tasks/:taskId/log` |
| 机器人池启动从 DB 全量重建 | Redis 只是缓存：进程崩溃时 `SPOP` 取走的 ID 不归还，旧实现「key 存在就跳过初始化」会让池子永久漏光 |
| pending→running 乐观锁 + 幂等短路 | BullMQ 是 at-least-once，重投会重复上传微信、重复发通知 |
| 分支白名单前置到触发阶段 | `buildCommand` / 分支名会拼进 shell，曾可注入 `main; ls`；重试旧任务也要重新校验 |
| `tsconfig.build.json` 排除 `var` / `public` | pnpm 依赖缓存里的源码被 `nest build` 编译，报 121 个 tsc 错误；子配置的 `exclude` 会覆盖父配置 |
| 新增资源用弹框 + `created` 事件 | 项目表单内添加凭证/机器人后刷新选项并立即选中，避免跳走丢失表单；`n-modal` 必须用 `:show` + `@update:show`，不能 `v-model` 绑只读 prop |
| i18n 枚举映射同时作用于 `series.data` 与 `legend.formatter` | 只改一处会出现中文界面显示 `native`、图例百分比丢失 |

### 2.7 前端结构

`views/`：`login`、`dashboard`、`projects/index.vue`（列表 + 新增弹框）、`projects/[id].vue`（详情 / 设置 / 构建历史 / 终端）、`admin/{users,credentials,robots,audit-logs}`、`error/403`。
关键组件：`WebSocketTerminal.vue`（先补历史日志再接 WS，历史模式用签名路径补二维码）、`QuickAddCredential.vue`、`QuickAddRobot.vue`。
其余：`api/`（Axios 封装，401 会话过期处理，登录 401 单独放行以显示真实错误）、`i18n/`（zh-CN / en-US）、`store/`（Pinia 持久化）、`router/`、`layout/`。

### 2.8 目录结构

```text
avocado/
├── apps/api/
│   ├── prisma/            schema.prisma · migrations/ · seed.js
│   ├── src/common/        守卫 · 拦截器 · 过滤器 · 加密/签名/分支工具 · Redis 适配器
│   ├── src/modules/       auth users projects resources build dashboard ws
│   ├── public/storage/    二维码与产物 ZIP（运行时生成，已 ignore）
│   ├── var/               日志 · 依赖缓存 · 构建工作区（运行时生成，已 ignore）
│   ├── private-keys/      微信上传密钥（本地文件，已 ignore，绝不入库）
│   └── Dockerfile / entrypoint.sh
├── apps/frontend/         Vue3 前端 + Dockerfile + nginx.conf
├── document/              TEST-CASES.md · TEST-REPORT-2026-11-18.md · REFACTOR-PLAN.md
├── docker-compose.yml / docker-compose.prod.yml
├── .env.example / .github/workflows/docker-publish.yml
└── README.md（本文）
```

### 2.9 重新跑起来

**本地（Windows 实测通过）**

```bash
# 依赖：Node >= 20、PostgreSQL、Redis、pnpm >= 9
cp .env.example .env                 # 或直接用 apps/api/.env
cd apps/api && npx prisma migrate deploy && npx prisma db seed
# 启动 API :3000 和前端 :5173
cd ../.. && pnpm dev
```

已知环境坑：

- 本机 pnpm 11 上 `pnpm dev` 会触发 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 试图重装依赖；绕过方式是直接跑 `node node_modules/@nestjs/cli/bin/nest.js start --watch` 与 `node node_modules/vite/bin/vite.js --port 5173`，`start-dev.cmd` 已封装（含本机绝对路径，换机器即失效，已 ignore）
- 本机是 PostgreSQL 18 + Redis 5.0.14.1，compose 里是 15 / 7；两者都能跑，但不要混用配置
- `.env` 在 `apps/api/` 下（`ConfigModule` 的 `envFilePath` 相对 API 工作目录），根目录 `.env.example` 只作模板

**Docker**

```bash
docker-compose -f docker-compose.prod.yml up -d   # 使用 GHCR 预构建镜像
# 或 docker-compose up -d                        # 本地构建
```

容器启动自动执行迁移与 seed。默认账号 `admin` / `123456`（`ADMIN_DEFAULT_PASSWORD` 可改，本机开发环境设过不同值，以本地 `.env` 为准）；前端 `http://localhost`，API `http://localhost:3000`，Swagger `/api/docs`。

**环境变量（真实读取项）**

| 变量 | 用途 | 默认值 / 风险 |
|---|---|---|
| `DATABASE_URL` | Prisma 连接串 | 无默认，必填 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | BullMQ、机器人池、WS 适配器 | `localhost` / `6379` / 空 |
| `JWT_SECRET` | JWT 签名；签名 URL 的回退密钥 | `super-secret-key-change-me`，生产必改 |
| `URL_SIGN_SECRET` | 二维码 / 产物 ZIP 的 HMAC 密钥 | 未设则回退 `JWT_SECRET`，再回退硬编码值，**建议显式配置** |
| `ENCRYPTION_KEY` | 凭证与机器人 secret 的 AES 密钥（32 字符） | 有硬编码默认值，未配置等于加密形同虚设 |
| `API_BASE_URL` | 通知与二维码的完整链接前缀 | `http://localhost:3000` |
| `PORT` | API 端口 | `3000` |
| `ADMIN_DEFAULT_PASSWORD` | 首次 seed 的管理员密码 | `123456` |
| `POSTGRES_USER/PASSWORD/DB` | compose 数据库初始化 | `root` / `password` / `avocado` |

`.env.example` 只列了其中 5 项，且带弱默认口令；投产前必须逐项替换。

---

## 三、已知边界

### 3.1 安全（若要继续用，先处理这些）

| 级别 | 问题 | 现状 / 待办 |
|---|---|---|
| 高 | 两把微信上传密钥（`227f7997…`、`cab6ad6d…`）曾被提交进**公开仓库**，由 `12dff43`、`9465070` 引入 | 微信后台已重置、本地文件已删除，但 **git 历史仍在**。待办：`git filter-repo` 清历史 → force push → 所有协作者重新 clone；`.gitignore` 已补 `*.key` / `private-keys/`，但不会作用于已追踪文件 |
| 中 | `ENCRYPTION_KEY` / `URL_SIGN_SECRET` / `JWT_SECRET` 有硬编码回退值 | 未配置时 AES 加密和签名保护都可被预测；部署必须显式设置 |
| 中 | 构建在 **API 进程所在的宿主机**上执行，非容器隔离 | 分支名有白名单防注入，但仓库里的 `buildCommand` / 依赖安装脚本本身是可信边界：只应接入自己可控的仓库 |
| 中 | 默认管理员口令 `123456`、compose 默认数据库口令 `password` | 仅适合本地；公网部署前必改 |
| 低 | 签名 URL 7 天有效、可转发 | 设计为「免登录给 IM 机器人拉图」，不是访问控制；需要更强隔离应改短期签名 + 鉴权代理 |

### 3.2 产品定位

- 未做任何用户验证：没有真实团队试用，没有回答「为什么不用 GitHub Actions + 上传脚本」
- 「平台」的价值只在多项目 / 多人并发 / 审计 / 密钥集中管理时成立；单人发版场景属于过度设计
- 部署成本（NestJS + Postgres + Redis + 微信 IP 白名单）是实际推广阻力

### 3.3 功能与技术边界

- 只支持**微信小程序**，`FrameworkType` 只有 `native` / `uniapp`；依赖 `miniprogram-ci`，微信侧需要上传密钥与 IP 白名单
- 构建在单机进程内，并发固定 3、机器人上限 30；无分布式 Runner、无水平扩容、Redis 单点
- 无多环境发布 / 审批流 / SSO / 细粒度到操作级的 RBAC；权限是「超管 + 项目三角色」两级
- 产物保留策略按 `retentionCount` 清理，日志与二维码按日清理；没有对象存储、没有异地备份
- Webhook 只处理 Push 事件 + 默认分支匹配，未覆盖 PR / tag 等场景

### 3.4 测试覆盖边界

- 68 条端到端用例中 **9 条未执行**（需人工或缺少前置资源），见测试报告
- 单元测试只有 6 个 spec 文件，集中在 processor / artifacts / guard，Service 层与前端基本靠手工验证
- 权限矩阵中「构建日志」guest 返回 200 一项，报告里标注为未复验，重启前应先确认是否越权
- 全流程只在**单机 Windows + 本机 Postgres/Redis** 上验证过；Docker 生产编排、GHCR 镜像未做端到端复验

### 3.5 运维残留（不影响代码）

| 项 | 状态 |
|---|---|
| `apps/api/var/` | 约 151 MB 依赖缓存与日志，已 ignore，可随时删 |
| `apps/api/public/storage/` | 约 1.9 MB 二维码 / 产物，已 ignore |
| 数据库 | 留着 2 个有效项目、若干软删除记录和测试数据；未写一次性清理脚本 |
| `86e5c3e0…key` | 对应「软删除前的 story-collection」，孤儿文件，确认不用可手动删 |
| `df33693f…key` | **正在被 story-collection 使用，不要删** |
| `start-dev.cmd` | 含本机绝对路径 `D:\lbs\...`，已 ignore，换机器需重写 |

### 3.6 未实现（原 v2.0 设想，已不排期）

多平台小程序（支付宝 / 抖音）、Pipeline as Code 与可视化编排、独立 Runner 与容器隔离、多环境 + 审批流、插件体系、DORA 度量、邮件通知、SSO/LDAP/OAuth。
其中「构建缓存」和「项目级权限」在旧 Roadmap 里标成待办，实际已经实现，本版按实况修订。

---

## 四、如果半年后要重启

1. **先清密钥历史**（3.1 第一条），再换 `ENCRYPTION_KEY` / `URL_SIGN_SECRET` / `JWT_SECRET` 与所有默认口令
2. **先找 1 个真实团队试用**，验证「团队并发发版 + 审计」是否有人愿意部署；没有就不要加功能
3. 若验证通过，第一件事是把构建执行器拆成隔离容器（当前最大技术债），再考虑多平台与审批流
4. 补上 3.4 的未复验项与 Service 层测试，尤其是权限矩阵
5. 复验 Docker 生产编排，把 `.env.example` 补全并去掉弱默认值

**最快捡起来的文件顺序**：`README.md` → `apps/api/prisma/schema.prisma` → `apps/api/src/main.ts` + `app.module.ts` → `build-job.processor.ts` → `common/guards/project.guard.ts` → `document/TEST-REPORT-2026-11-18.md`。

---

## 五、文档索引与许可

| 文档 | 内容 |
|---|---|
| `document/TEST-CASES.md` | 90 条测试用例 + 12 步黄金路径 + 所需凭证清单 |
| `document/TEST-REPORT-2026-11-18.md` | 68 条实际执行结果、12 个缺陷与修复明细 |
| `document/REFACTOR-PLAN.md` | Phase 0/1/2 重构记录 |
| 本文 | 项目总结 + 架构说明 + 已知边界 |

UNLICENSED — 私有项目许可；仓库托管在 `github.com/Sensems/avocado`。
