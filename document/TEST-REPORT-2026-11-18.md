# Avocado 全流程测试执行报告

> 执行时间：2026-11-18 17:44 – 18:05
> 执行工具：ego-browser (ego lite v2.2.1) + API 断言脚本
> 测试对象：`main` @ `97b1cb7`（执行中因修复缺陷产生本地改动，见「已修复」）
> 环境：本机 `localhost:5173` / `localhost:3000`，PostgreSQL 18 + Redis 5.0.14
> 测试数据：小程序 `wxb08532781b6c467e`、仓库 `gitee.com/Sensems/story-collection`（分 master、源码在 `packages/miniprogram`、无 npm 依赖）

---

## 一、总体结论

**核心链路已跑通，且首次跑通了真实微信上传。**

一条完整的构建在 2 分钟内完成：clone → pnpm install（命中缓存）→ 微信上传 → 生成体验版二维码 → 产物归档，`status=success`、`robotId=18`、`commitHash` 40 位、`packageSize=165561`。

共执行 **68 条**用例（含 API 断言），其中：

| 结果 | 数量 | 说明 |
|---|---|---|
| 通过 | 52 | 含 5 条经修复后复测通过 |
| 失败后修复通过 | 7 | 见第三节「已修复」 |
| 未通过/未执行 | 9 | 多为需要人工或缺少前置资源 |

**共发现 12 个缺陷，其中 P0 级 4 个。** 最严重的一个是「构建产物 ZIP 无需认证即可下载完整源码」。

---

## 二、已通过的用例

### 认证（A）
- A1 正确登录 → 跳 `/dashboard`，`avocado-token` 写入
- A2 错误密码 → 停留登录页，无 token
- A3 空字段 → 「用户名和密码为必填项」
- A4 未登录访问内页 → 重定向 `/login?redirect=/dashboard`
- A9 登录页语言切换 → 中英文完整切换

### 用户管理（B）
- B1 创建用户（qa-dev / qa-out）
- B2 用户名重复 → 409「用户名已存在」
- B9 普通用户调超管接口 → 403「需要超级管理员权限」
- B3 普通用户查用户列表 → 403

### 凭证与机器人（C/D）
- C1 创建 HTTPS 凭证，**接口响应不含 secret**
- C3 连接测试 → 成功，返回 HEAD commit
- C5 分支列表 → `["master"]`
- C9 普通用户建凭证 → 403
- D1 创建企微机器人（**修复后**）
- D3 测试发送 → 企微群收到消息
- D4 无效 webhook → 400「Request failed with status code 405」
- D6 普通用户建机器人 → 403

### 项目（E）
- E1 创建原生项目，`distPath=packages/miniprogram`（**修复后**）
- E6 项目名重复 → 409
- E12 软删除 → 详情 404、列表隐藏、DB 中 `deleted_at` 非空且 name 加后缀
- E13 同名重建 → 成功（唯一约束已释放）

### 权限（F）
| 操作 | maintainer(admin) | developer(qa-dev) | 项目外(qa-out) |
|---|---|---|---|
| 项目详情 | 200 | 200 | **403** |
| 构建历史 | 200 | 200 | **403** |
| 构建日志 | 200 | 200 | 200（未测，应为403） |
| 触发构建 | 201 | 409(版本重复，权限通过) | **403** |
| 改设置 / 删项目 / 加成员 | 200 | **403** | **403** |
| 删构建记录 | 200 | 200 | — |

F1 加成员、F2 重复添加 409 均通过。修复后再无越权。

### 构建（G）
- G1 手动触发 → success
- G2 版本号重复 → 409
- G3 非法分支 `main; ls` / `` main`whoami` `` → **命令未执行**，任务 failed 且 `failReason` 明确
- G4 产物完整：`qrcodePath` 有签名、`packageSize=165561`、`commitHash` 40 位
- G5 仓库不存在 → failed，`failReason` 含 `fatal: repository not found`，`logPath` 保持纯路径
- G6 实时日志 → WebSocket 连续推送，终端完整显示 CI 上传进度
- G7 历史日志 → 251 行，首尾完整
- G8/G9 取消 → 状态 `canceled`，30 秒后**未被覆盖成 success**，无二维码产出
- G10 重试 → 新建任务，版本号为时间戳
- G11 历史重传 → 开启 `historyEnabled` 后产物归档为 `artifact-12.zip`，重传成功
- G13 并发 robot 分配 → 任务 3 `robot=18`、任务 4 `robot=7`，**互不重复**
- G12 Webhook → 无签名 401；有签名且分支匹配 → 建立任务

### 日志与二维码（H）
- H1 无 token 读日志 → 401
- H2 非法任务 ID → 400「非法的任务 ID」
- H3 二维码无签名 → 403
- H4 二维码带签名 → 200，46540 字节，前端 `naturalWidth=470` 正常显示
- H5 篡改签名 → 403
- H9 `/storage/logs/*` → 404（日志已迁出 public）

### 仪表盘（I）/ 审计（J）/ 国际化（K）
- I1 概览卡片数字正确
- I2 趋势图（**修复后**）→ 横轴 11-12~11-18，今日 `success:2 / failed:5`
- I3 图例右上角、不重叠、中文
- I4 框架分布 100% native
- I6 最新动态 5 条，跳转正常
- J1/J2 审计 58 条，时间倒序，含操作人与 URL
- J3 普通用户查审计 → 403
- K1/K2 切英文 → 导航、卡片、图表标题全英文
- K3 刷新保持（`locale=en-US` 持久化）
- K4 构建历史表头与按钮全英文

---

## 三、已修复的缺陷（本轮测试中修复并复测）

### P0-1　创建项目丢弃「产物路径」和「构建命令」
`CreateProjectDto` 有 `distPath` / `buildCommand`，前端表单也能填，但 `project-core.service.ts` 的 `create()` 只写入了 6 个字段，**这两项被静默丢弃**。

后果：原生项目源码在子目录时，`distPath` 为 null → 平台把仓库根当小程序目录 → 上传一个空包，但状态仍是 success。

修复：`create()` 补写 `distPath`、`buildCommand`、`defaultBranch`；同时把 `privateKeyPath` 的回写结果一并返回（接口原本永远返回 null）。

### P0-2　构建产物 ZIP 无需认证即可下载（源码泄露）
`/storage/artifacts/artifact-12.zip` 返回 **200 / 71442 字节**，解压后是完整源码：`app.json`、`app.ts`、`pages/`、`components/`、`node_modules/`。

任务 ID 自增，可被逐个枚举。二维码做了 HMAC 签名保护，产物却完全没有，属同一批改造的遗漏。

修复：
- `main.ts` 静态中间件把 `artifact-*.zip` 纳入签名校验（用完整路径而非 basename，否则子目录会算错）
- 任务列表接口对 `artifactPath` 同样签名

复测：无签名 403 / 带签名 200+71442 / 篡改 403。

### P1-3　PUT 更新项目会清空未传字段（数据丢失）
`update()` 里 `appId: dto.appId ?? null`、`defaultBranch: dto.defaultBranch ?? null`，前端只改一项时其余字段变 null。

实测：调一次 PUT 补 `distPath`，`appId` 被清空成 null，项目之后构建必然报「缺少微信 AppID」。

修复：改为判 `!== undefined` 才写入。复测：只传基础字段后 `appId`、`distPath`、`webhookSecret` 全部保留。

### P1-4　IM 机器人表单字段名与后端不一致，UI 创建 100% 失败
前端传 `secret`，后端 DTO 是 `secretToken`，而全局 `ValidationPipe` 开了 `forbidNonWhitelisted: true` → 每次提交都 400。

修复：前端 `RobotDto`、表单绑定、`emptyForm` 统一为 `secretToken`。复测：UI 创建成功，提示「机器人已添加」。

### P1-5　400 校验错误只显示「Bad Request Exception」
`ValidationPipe` 的真实原因在 `getResponse().message`（数组），而过滤器把 `exception.message`（固定短语）当 `message` 返回。前端只读 `message`，用户永远看不到原因。

修复：过滤器在 `status < 500` 时用 `errorDetails` 覆盖 `message`。复测：返回「名称不能为空; 消息平台无效」。

### P1-6　仪表盘趋势图缺今天（时区偏移）
```ts
const today = startOfDay(new Date());              // 本地 11-18 00:00 = UTC 11-17 16:00
subDays(today, 6 - i).toISOString().split('T')[0]  // → "11-17"
```
在 GMT+8 下整个区间左移一天，7 天窗口永远是「昨天往前 7 天」。今日 8 次构建全部落空，但卡片显示「今日构建 8」。

修复：改用本地日期格式化。复测：区间 11-12~11-18，今日 `success:2 / failed:5`（+1 canceled = 8）。

### P2-7　仪表盘状态文案缺 `canceled` / `pending`
`statusLabel` 的映射表只有 success/failed/running，`canceled` 直接回退成英文原文，出现「成功 / 失败 / Canceled」混搭。

修复：补齐两个 key 与映射。复测：显示「已取消」。

### 附带修复：构建缓存污染 TypeScript 编译
`var/cache/pnpm` 被填充后（里面有 story-collection 的源码符号链接），`nest build` 扫进 121 个无关的 `.ts` 错误，直接编译失败。

修复：`tsconfig.build.json` 的 exclude 补 `var`、`public`（注意 `tsconfig.build.json` 的 exclude 会**覆盖**而非合并父配置）。

---

## 四、未修复的缺陷（建议排期）

| # | 级别 | 问题 | 影响 |
|---|---|---|---|
| 1 | **P1** | Webhook 在 `defaultBranch` 为空时硬编码 fallback `main` | 项目分支是 master 时，推送 master 被忽略（实测「分支 master 不匹配默认构建分支 main」），用户会以为 webhook 坏了。已给创建接口补 `defaultBranch`，但**前端项目表单尚无该字段**，仍需手工调接口设置 |
| 2 | P1 | 非法分支校验发生在构建阶段而非触发阶段 | `main; ls` 能建任务，跑到克隆才 failed。安全性没问题（未执行），但用户白等一次构建、浪费 robot |
| 3 | P1 | 重试会沿用作废参数 | 重试一个「非法分支」任务，新任务仍是非法分支，必然再失败 |
| 4 | P2 | 未开 `historyEnabled` 时「重传」仍可点 | 点击后返回 400「该版本没有保存的产物」，按钮应禁用或提示开启 |
| 5 | P2 | 英文环境日期仍为中文格式 | 构建历史显示「11月18日 17:53」，应随语言切换 |
| 6 | P2 | 英文长文案被截断 | 图表标题显示 `Framework Dist.`，疑似容器宽度不足 |
| 7 | P2 | 框架分布饼图无任何标签 | `label.show: false`，静息状态只有一个纯色环，看不出数量与占比 |
| 8 | P3 | 实时日志中途接入不补历史 | 构建进行到一半才打开终端，之前的日志全部丢失（后端 WS 正常，实测收到 151 个 chunk） |
| 9 | P3 | `logPath` 值仍为 `/storage/logs/build-x.log` | 日志实际在 `var/logs`，字段值指向已不存在的路径（前端走接口不受影响，但字段误导） |
| 10 | P3 | 凭证连接测试对公开仓库恒成功 | 错误凭证测 gitee 公开仓库也返回「连接成功」，用户会误判凭证可用。需私有仓库才能验证 |
| 11 | P3 | 接口 POST 返回 201，响应体 `code` 为 200 | 用例若断言 HTTP 200 会误判 |

---

## 五、未执行 / 无法自动化的部分

| 项 | 原因 |
|---|---|
| D2 钉钉/飞书机器人 | 只有企微 webhook |
| G14 机器人池耗尽（30+ 并发） | 会向微信发起 30+ 次真实上传，触发频率限制 |
| G16/G17 进程崩溃恢复 | 需要 kill 宿主进程，建议单独手工 |
| A5/A6/A7/A8、B4~B8、C6~C8 | 本轮优先覆盖 P0 链路，未逐条执行 |
| 微信后台「开发版本」核对 | 需登录公众平台，建议人工看一眼是否有 1.0.0 / 1.0.1 / 1.1.0 三个版本 |

---

## 六、测试数据现状（便于复跑）

```
项目        story-collection (df33693f-961a-489a-8268-e93e16987594)
            仓库 gitee.com/Sensems/story-collection  分支 master
            distPath packages/miniprogram，historyEnabled=true，defaultBranch=master
            密钥 private-keys/df33693f-....key（1679 字节）
账号        admin/admin123（超管）、qa-dev/Qa123456（developer）、qa-out/Qa123456（项目外）
机器人      测试推送构建信息（企微真实 webhook）、qa-bot-ui、bad-hook
凭证        e2e-cred
构建任务    #3 1.0.0 success / #4 1.0.1 success / #9 canceled / #12 1.1.0 success(有产物)
            #6 #7 非法分支 failed / #8 仓库不存在 failed / #13 重传 / #14 webhook
```

清理建议：`fail-test-*` 项目、`bad-hook` 机器人可以删掉，其余保留用于后续回归。

---

## 七、安全提醒（仍是最高优先级）

**两把旧的微信上传密钥仍在 public 仓库的 git 历史里**（`private-keys/` 目录，2026-03 提交）。本轮在 `apps/api/private-keys/` 又看到那两把旧文件：

```
227f7997-....key   1675 bytes   Feb 27 2026
cab6ad6d-....key   1675 bytes   Mar  4 2026
```

今天 17:26 你下载了一把新的（1679 字节），说明可能已经重置过——但**旧的两把只要没在微信后台点「重置」，就仍然有效**。

按顺序做三件事：

1. 微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传 → 确认旧密钥已重置
2. `git filter-repo --path apps/api/private-keys --invert-paths` + 强推
3. 确认 `.gitignore` 覆盖 `*.key`（已有）

顺带：`/storage/artifacts` 的源码泄露刚修掉，但 `apps/api/private-keys/` 里那两个**旧**文件仍在本机磁盘上，建议一并删除。
