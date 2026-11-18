# Avocado 重构计划

> 版本：v2（v1 自我 review 后修订）
> 日期：2026-11-18
> 前置判断：当前库为空、无真实用户 → 允许破坏性变更，不写复杂数据迁移

---

## 0. 目标与非目标

**目标**：从「能演示」变成「敢让人用」。判断标准是三条——构建足够快、失败能追溯、并发不出错。

**非目标**：不补新功能。除「缓存 / 可追溯 / 交付闭环」三件外，一律不动。

---

## 1. Phase 0 — 止血（预计 2.5 天）

这一阶段全是「改错了会出事」的问题，每项都必须单独验证。

### P0-1 WebSocket 鉴权

| 项 | 内容 |
|---|---|
| 问题 | `ws.gateway.ts:28` 的 `handleConnection` 里只有一行注释掉的 `// e.g: this.authService.verify(token)`，任何人连上即可订阅全部构建日志 |
| 改动 | 后端：`handleConnection` 从 `client.handshake.auth.token` 取 JWT，`JwtService.verify` 失败则 `client.disconnect()`。前端：`WebSocketTerminal.vue` 建连时带 `auth: { token }` |
| 文件 | `modules/ws/ws.gateway.ts`、`components/WebSocketTerminal.vue` |
| 验收 | 无 token / 伪造 token 连接立即断开；有效 token 可正常收日志 |
| 风险 | 前端旧连接方式会断，必须同批提交 |

### P0-2 构建日志访问控制

| 项 | 内容 |
|---|---|
| 问题 | `useStaticAssets(public)` 无任何守卫，而日志路径是 `/storage/logs/build-{taskId}.log`，`taskId` 为自增 BigInt，可被遍历 |
| 改动 | 日志不再走静态直出，统一走已有的 `GET /api/build-tasks/:taskId/logs`（补 `JwtAuthGuard` + `ProjectGuard`）。前端改下载地址 |
| 文件 | `main.ts`、`build-tasks.controller.ts`、前端构建详情 |
| 验收 | `curl /storage/logs/build-1.log` 返回 404。**注意：必须把 `logs` 整个目录移出 `public`（或对 `/storage/logs/*` 前缀加中间件拦截），仅前端不显示不算修好**；登录且有权限后走接口能拿到内容 |
| 说明 | **二维码不在此列**——IM 机器人拉图需要公网无鉴权 URL，强行加锁会打断通知。二维码方案见 P2-3，需要你决策 |

### P0-3 git 命令注入

| 项 | 内容 |
|---|---|
| 问题 | `git clone ... -b ${branch} ${repoUrl}` 走 `shell: true`，`branch` 来自用户输入，可注入任意命令 |
| 改动 | `runCommand` 拆成两个：`runShell`（给用户配置的 `buildCommand`，必须走 shell）和 `runExec`（固定命令 + 参数数组，git clone 用它）。`branch` 增加 `/^[\w.\/-]{1,100}$/` 校验，不通过直接拒绝 |
| 文件 | `build-job.processor.ts`、`trigger-build.dto.ts` |
| 验收 | `branch` 传 `main; touch /tmp/pwned` 时接口返回 400，且 `/tmp/pwned` 不存在 |
| 说明 | `buildCommand` 保留 shell 执行是设计使然（它本来就是自由命令），但要在 UI 标注「仅受信任成员可配置」，并确保只有 maintainer 能改 |

### P0-4 机器人池以数据库为真相源

| 项 | 内容 |
|---|---|
| 问题 | `RobotPoolService` 用 Redis SET 存池，`SPOP` 出去后进程崩溃就不归还；`initializePool` 只在 key 不存在时初始化，池空但 key 在 → 永久卡死 |
| 改动 | 启动时：①把 `status=running` 且 `updatedAt` 超过 30 分钟的任务置为 `failed`；②用 DB 重建池（所有 active 任务的 `robotId` 从池中移除，其余补齐）。Redis 降级为纯缓存 |
| 文件 | `robot-pool.service.ts`、`build-job.processor.ts` |
| 验收 | 构建中直接 `kill -9` 进程，重启后 `scard` 回到 30，且僵死任务变 failed |
| 为什么提前 | 原计划放在 Phase 1，但它和 P0-5 是同一件事的两端：池子漏光时传 robot 只会让失败更难猜。必须先修池子 |

### P0-5 robot 传给微信

| 项 | 内容 |
|---|---|
| 问题 | `ci.upload({...})` 和 `ci.preview({...})` 都没有 `robot` 参数，30 个机器人池白做，所有上传共用默认机器人，体验版互相覆盖——**这正是 PRD 第一条痛点，目前完全没解决** |
| 改动 | 两处调用补 `robot: robotId` |
| 验收 | 同时触发两个项目构建，在微信后台「版本管理」确认两次上传来自不同机器人号；两个体验版互不覆盖 |
| 说明 | 这一行是整个项目里投入产出比最高的改动，建议第一个做 |

### P0-6 取消真实生效

| 项 | 内容 |
|---|---|
| 问题 | `cancelTask` 只改 DB 状态且写成 `failed`，worker 照常跑完，最后 `update({ status: success })` 把失败覆盖成成功 |
| 改动 | ①`cancelTask` 写 `canceled`（枚举已有），不再往 `logPath` 塞文字；②worker 在 clone 前、install 后、upload 前各查一次状态，`canceled` 则中止；③最终状态更新用 `updateMany` + `where: { id, status: { not: 'canceled' } }` |
| 文件 | `build-tasks.service.ts`、`build-job.processor.ts` |
| 验收 | 触发构建后在 install 阶段取消，最终 DB 为 `canceled`，微信后台无新版本 |
| 已知限制 | `ci.upload` 一旦发出无法中断，只能等它返回后再跳过后续步骤。这个限制要在 UI 上说明，别装作能秒停 |

### P0-7 幂等（防重复上传）

| 项 | 内容 |
|---|---|
| 问题 | 入口只拦 `canceled`/`failed`，漏了 `success`；BullMQ at-least-once 重投会重复上传微信 |
| 改动 | 用乐观锁抢占：`updateMany({ where: { id, status: 'pending' }, data: { status: 'running', robotId } })`，`count === 0` 直接 return。这同时解决了两端并发消费 |
| 验收 | 用同一 `jobId` 手动投递两次，只产生一次微信上传 |

### P0-8 数据库索引与唯一约束

| 项 | 内容 |
|---|---|
| 改动 | `@@index([projectId, createdAt])`、`@@index([status])`、`@@index([triggerUserId])` 于 BuildTask；`@@index([createdAt])`、`@@index([userId])` 于 AuditLog；`@@index([userId])` 于 ProjectMember；**`@@unique([name])` 于 Project**（替掉 `project-core.service.ts:24` 的 `findFirst` 手工查重，否则并发下会创建同名项目） |
| 验收 | `EXPLAIN` 任务列表查询从 Seq Scan 变 Index Scan；并发两个请求创建同名项目，第二个被 DB 拒绝 |
| 说明 | 数据量小，直接 `migrate deploy` 即可，不需要 CONCURRENTLY |

### P0-9 定时器泄漏

`runCommand` 的 10 分钟 `setTimeout` 从不 `clearTimeout`，每个命令留一个定时器到进程退出。改为保存引用、`close` 时清除。

### P0-10 IM 通知阻塞构建

| 项 | 内容 |
|---|---|
| 问题 | `notifyRobots` 串行 `await axios.post` 且**没有 timeout**。一个钉钉/企微 webhook 挂住，整个构建流程停在那一步 |
| 改动 | 加 `timeout: 5000`，改用 `Promise.allSettled` 并发发送，单个失败只记日志不影响主流程 |
| 验收 | 故意配一个不可达的 webhook URL，构建仍在 5 秒内完成，状态正常 |

---

## 2. Phase 1 — 可用性（预计 4.5 天）

### P1-1 构建缓存

| 项 | 内容 |
|---|---|
| 问题 | 每次 `emptyDir` 后全量 `pnpm install`，2-4 分钟，真正的编译只占 20 秒 |
| 改动 | 分两步：①包管理器 store 固定到 `public/.cache/{pnpm,yarn,npm}`（**必须在 workspace 之外**，否则被 `emptyDir` 清掉），install 追加对应缓存目录参数；②若 store 复用收益不足 50%，再上 `node_modules` 快照（key = lockfile hash，直接解压到 workspace）。无论哪种，都必须配 LRU 清理，上限 5GB |
| 验收 | 同项目第二次构建，install 阶段耗时下降 ≥ 50% |
| 风险 | 磁盘增长、以及缓存损坏导致「本地能装远程不能装」。需要提供 `--no-cache` 手动旁路 |

### P1-2 commitHash 落库

clone 成功后执行 `git rev-parse HEAD`，写入 `BuildTask.commitHash`。字段早就有，代码从没填过，导致所有构建记录都无法追溯到具体提交。

### P1-3 包体积统计

schema 加 `packageSize Int?`，上传成功后统计 `distPath` 目录字节数。**验收包含前端展示**，否则数据存了没人看等于没做。

### P1-4 BullMQ 正确配置

- `defaultJobOptions`: `attempts: 2`、`backoff: { type: 'exponential', delay: 5000 }`、`removeOnComplete: { age: 3600, count: 100 }`
- 用 `throw new DelayedError()` 替换当前的 `moveToDelayed() + throw new Error()`
- **concurrency 显式设为 3**。30 个机器人是「AppID 隔离」用的，不是并发数；本机同时跑 30 个 clone + install 会直接卡死

### P1-5 构建重试

新增 `POST /api/build-tasks/:taskId/retry`，复制原任务的 branch / version / desc / 触发人，创建新任务入队。现在失败后只能回列表手填一遍。

### P1-6 版本号唯一性

上传前校验同项目同 `version` 是否已成功上传过，重复则拒绝并提示。微信侧会报错，但等它报错太晚了。

### P1-7 临时工作区与产物的清理责任

| 项 | 内容 |
|---|---|
| 问题 | `os.tmpdir()/avocado-builds/{taskId}` 只在正常路径 `fs.remove`，进程崩溃后永久残留；`public/storage` 下的二维码、日志、ZIP 没有任何保留策略 |
| 改动 | ①服务启动时清理 tmpdir 下超过 24 小时的残留工作区；②定义保留策略：日志保留 30 天、二维码保留 7 天、产物按 `retentionCount`（已有字段，目前只对 ZIP 生效）；③删除任务时同步删文件 |
| 验收 | 跑 10 次构建后磁盘增量稳定，不随次数线性增长 |

---

## 3. Phase 2 — 结构（预计 5 天，含补测试，纯重构不混功能）

### P2-1 `ProjectImRobot` 中间表

替掉 `Project.imRobotIds Json`。迁移脚本把现有 JSON 展开成行。当前数据为空，可用 `migrate reset`，但脚本仍要写好，因为将来私有化部署要用。

### P2-2 拆分 `build-job.processor.ts`（700 行 → 4 个类）

**前置条件：先补测试，再动刀。** 当前 processor 零测试覆盖，`taskId` 贯穿全流程、大量隐式状态，直接拆只能靠手工回归，拆错了要很久才暴露。先补三条关键路径的单测（正常构建 / 上传失败 / 机器人不可用），用 mock 掉 `spawn`、`ci`、`fs`。

`BuildRunner`（clone/install/build）、`MiniprogramUploader`（封装 ci 调用）、`BuildNotifier`（IM 通知）、`WorkspaceManager`（临时目录生命周期）。

**这一项风险最高，必须单独一个提交，不夹带任何逻辑变更**，改完要能证明行为完全一致。

### P2-3 二维码访问策略（需你决策）

三个选项，各有代价：

- **A. 保持公开**（现状）：简单，但任何人猜到 taskId 就能拿二维码。二维码本身只是预览入口，泄露危害有限
- **B. HMAC 签名 URL**：`/storage/qrcode-3.jpg?sig=xxx`，机器人能拉、外人猜不到。需要加签名逻辑和过期策略
- **C. 完全鉴权**：最安全，但 IM 通知里的图片会挂掉，需要改成「点链接跳登录页」

我倾向 **B**，但它会让 URL 变长且需要处理过期。

### P2-4 `logPath` 语义修正

新增 `failReason Text?` 字段。`logPath` 只存路径，失败原因存 `failReason`。现在 `logPath` 里混着 `'构建被用户取消'` 这类文本，前端当 URL 用会直接坏。

### P2-5 软删除

`Project` / `BuildTask` 加 `deletedAt`。现在删项目会级联删掉全部构建历史和审计对象，私有化部署的客户不会接受。

---

## 4. 暂不做（列出触发条件，防止范围蔓延）

| 功能 | 什么时候做 |
|---|---|
| 提审 / 审核状态 / 灰度发布 | 有 2 个以上真实项目跑通完整流程后 |
| 备份与恢复 | 第一次对外交付私有化部署前，**这项是客户第一个会问的** |
| 登录限流、CORS 收紧 | 部署到公网前 |
| CI Token（外部系统调用） | 有人要求从 GitLab CI 触发时 |
| 包体积趋势图、产物对比 | 包体积数据积累 2 周后 |
| processor 之外的其他重构 | 上面 P2 全部完成后 |

---

## 5. 风险与回滚

| 风险 | 处理 |
|---|---|
| schema 变更不可逆 | 每次迁移前 `pg_dump`，保留到当天下班 |
| 池重建会打断正在跑的任务 | 选在没有运行中任务时重启，或先等任务结束 |
| processor 拆分引入行为偏差 | 单独分支，改前录一次完整构建日志作为基准，改后逐行 diff |
| 前端改动与后端不同步 | WebSocket 鉴权和日志路径两处必须前后端同批上线 |
| 缓存把磁盘写满 | 上线缓存的同时上 LRU，不留「以后再补」 |
| 20 多项改动混在一起无法定位问题 | 每项一个 commit；Phase 2 单独开分支（`refactor/phase2`），Phase 0/1 可直接进 main |

---

## 6. 每阶段验收清单

Phase 0 结束，手工跑一遍：

1. 两个项目同时触发构建 → 都成功，体验版互不覆盖
2. 构建中取消 → 状态 `canceled`，微信无新版本
3. 构建中 `kill -9` → 重启后池子恢复、僵死任务变 `failed`
4. 未登录访问 `/storage/logs/build-1.log` → 404/401
5. 未带 token 连 WebSocket → 立即断开
6. `branch` 传注入串 → 400 且无副作用

Phase 1 结束：

7. 同项目连续构建两次 → 第二次 install 时间下降一半以上
8. 每条构建记录都有 `commitHash` 和 `packageSize`

---

## 7. 需要你现在决策的三件事

1. **P0-2**：日志走接口鉴权（会改前端 URL），确认可以吗？
2. **P1-1**：缓存放 `public/.cache`（会被 nginx 静态暴露，但只是依赖包，无敏感内容），还是放 `var/cache` 之类不对外目录？
3. **P2-3**：二维码用 A / B / C 哪个方案？

---

## 8. 工作量汇总

| 阶段 | 内容 | 预计 |
|---|---|---|
| Phase 0 | 10 项止血 | 2.5 天 |
| Phase 1 | 7 项可用性 | 4.5 天 |
| Phase 2 | 5 项结构（含补测试） | 5 天 |
| 合计 | | **约 12 个工作日** |

Phase 2 的 5 天偏紧，因为它含「给 700 行 processor 补测试」这件事，补测试本身可能就吃掉一半。如果时间紧张，**Phase 2 可以整体推迟，它不影响系统正确性，只影响可维护性**。

按你现在的节奏，这大概是一个月。**建议先只做 Phase 0（10 项，2.5 天），做完立刻找人用**——剩下 9 天多的活，等有人抱怨了再按真实反馈排序。不要一次改完 20 项再去找用户，那又是老路了。
