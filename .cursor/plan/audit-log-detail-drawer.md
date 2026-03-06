# 实施计划：审计日志「查看详情」抽屉

## 〇、进度里程碑

| 阶段 | 名称           | 状态      | 完成度 | Demo                |
|------|----------------|-----------|--------|---------------------|
| 0    | 需求与数据对齐 | ✅ 已完成 | 2/2    | —                   |
| 1    | 后端字段与 API | ✅ 已完成 | 1/4    | —                   |
| 2    | 前端列表与按钮 | ✅ 已完成 | 5/5    | `/admin/audit-logs` |
| 3    | 详情抽屉与设计 | ✅ 已完成 | 8/8    | `/admin/audit-logs` |
| 4    | 文案与验收     | ✅ 已完成 | 3/3    | `/admin/audit-logs` |

**当前进度：** 实施已完成。
**整体完成度：** 19/22 任务（约 86%，可选 GET by id、请求头/响应体未实现）

---

## 一、需求与增强说明

### 1.1 原始需求

在审计日志列表中添加「查看详情」按钮，点击后通过**抽屉（Drawer）**展示单条日志的更多内容，例如：请求头、请求体、响应体等；页面设计与实现需遵循 **frontend-design** 与 **ui-ux-pro-max** 规范。

### 1.2 结构化需求

| 维度     | 说明 |
|----------|------|
| **目标** | 审计日志列表增加「查看详情」入口，以抽屉形式展示单条日志的扩展信息（请求 URL、请求体，及在数据具备时的请求头、响应体）。 |
| **技术约束** | 前端：Vue 3 + Naive UI + 现有 admin 深色风格；设计遵循 frontend-design、ui-ux-pro-max（字体、色彩、动效、可访问性、无 emoji 图标等）。 |
| **范围** | 仅限审计日志相关：列表操作列、抽屉组件、详情展示；若需请求头/响应体，需后端扩展后在前端展示。 |
| **验收标准** | 列表有「查看详情」按钮；点击后右侧抽屉打开并展示请求信息（含请求体）；UI 与交互符合设计规范；支持键盘与焦点、响应式；无横向滚动问题。 |

### 1.3 当前数据现状（关键）

- **Prisma `AuditLog`**：`id`, `action`, `targetId`, `changes`(Json), `ipAddress`, `createdAt`, `userId`, `user`。
- **写入来源**（`audit-log.interceptor.ts`）：`action = method + url`，`targetId = url`，`changes = request body`（JSON 序列化），**未存储请求头、响应体**。
- **结论**：当前可展示「请求 URL」（来自 `action`/`targetId`）、「请求体」（来自 `changes`）。请求头、响应体需在后端扩展 schema 与 interceptor 后再在抽屉中展示（本计划将请求头/响应体列为可选后端扩展 + 前端占位）。

---

## 二、技术方案

### 2.1 多角度结论摘要

- **实现**：列表沿用现有 `getAuditLogs` 数据；新增操作列与抽屉；详情优先用当前行数据（无需必选 GET by id）；后端仅做字段对齐与可选单条接口。
- **体验**：抽屉从右侧滑出、宽度适中（约 560–640px）；信息分区清晰（基本信息 / 请求 URL / 请求体 / 预留请求头·响应体）；深色主题与 admin 一致；焦点管理、`prefers-reduced-motion`、可读字体与对比度。
- **性能**：详情不强制请求接口，用列表行数据即可；若未来加 GET by id，可做按需加载与 loading。

### 2.2 方案选择

- **详情数据来源**：优先用列表行数据打开抽屉（无额外请求）；若产品要求「始终最新」或列表不返回大字段，再增加 `GET /audit-logs/:id` 与前端按需请求。
- **抽屉组件**：与项目现有用法一致，使用 Naive UI 的 `NDrawer` + `NDrawerContent`。
- **设计规范**：实施前参考 ui-ux-pro-max 的 design-system 输出（admin / 后台 / 深色），并遵循 frontend-design 的字体、色彩、动效与空间构图，避免通用 AI 风格。

---

## 三、实施步骤

### 阶段 0：需求与数据对齐

- [ ] **0.1** 与产品/后端确认：当前仅展示「请求 URL + 请求体」是否满足首版；若需要请求头/响应体，确认是否在本迭代扩展后端并约定字段名。
- [ ] **0.2** 确认列表「目标资源」列：后端是否统一返回 `resource`（建议映射为 `targetId`），避免列空。

### 阶段 1：后端字段与 API（可选按需）

- [ ] **1.1** 在 `audit-logs.service.ts` 的 `findAll` 格式化处，为每条记录增加 `resource: item.targetId`（或已存在则保持一致），保证前端 `colResource` 有值。
- [ ] **1.2** （可选）若需要按 id 拉取详情：在 `AuditLogsController` 增加 `GET /audit-logs/:id`，在 `AuditLogsService` 增加 `findOne(id)`，返回单条完整记录（含 user、resource、changes 等）。
- [ ] **1.3** （可选）若本迭代要支持请求头/响应体：在 Prisma 中为 `AuditLog` 增加 `requestHeaders`(Json?)、`responseBody`(Json?)（或 Text），并更新 `audit-log.interceptor.ts` 写入这两项；再在 list/detail 接口中返回。
- [ ] **1.4** 若新增或修改接口，在 `apps/frontend/src/api/audit-log.ts` 中增加对应类型与请求方法（如 `getAuditLogById(id)`）。

### 阶段 2：前端列表与按钮

- [ ] **2.1** 在 `apps/frontend/src/views/admin/audit-logs/index.vue` 中，为表格增加「操作」列（最后一列），使用 Naive UI 的 `NButton`，文案为「查看详情」；按钮使用 `cursor-pointer`、合适 `size`，并保证 44px 最小触控区域（ui-ux-pro-max）。
- [ ] **2.2** 在 i18n 中增加键：`admin.auditLogs.viewDetail`（中/英）、`admin.auditLogs.colOperations`（操作 / Operations），并在 columns 的 title 中使用。
- [ ] **2.3** 定义抽屉可见状态：`detailDrawerOpen = ref(false)`，当前选中行 `selectedLog = ref<AuditLogDto | null>(null)`。
- [ ] **2.4** 为「查看详情」按钮绑定点击：设置 `selectedLog = row`，`detailDrawerOpen = true`。
- [ ] **2.5** 若后端未返回 `resource`，前端在展示或传给抽屉时用 `row.targetId ?? row.resource` 作为「目标资源」显示，避免空白。

### 阶段 3：详情抽屉与设计规范

- [ ] **3.1** 在 `audit-logs/index.vue` 中增加 `NDrawer` + `NDrawerContent`，`v-model:show="detailDrawerOpen"`，`placement="right"`，宽度约 560–640px，`@after-leave` 时清空 `selectedLog`；标题使用 i18n（如「日志详情」）。
- [ ] **3.2** 抽屉内容结构（自上而下）：  
  - **基本信息**：用户、操作、目标资源(URL)、IP、时间（与列表一致，便于对照）。  
  - **请求信息**：  
    - 请求 URL（来自 `action` 或 `targetId`）。  
    - 请求体：展示 `changes`（JSON 时做格式化 + 可折叠/复制；字符串则原样展示）。  
  - **（可选）请求头 / 响应体**：当后端有对应字段时再展示；暂无则可不渲染或占位「暂无数据」。
- [ ] **3.3** 样式与设计系统：  
  - 使用与 admin 一致的深色背景（如 `bg-zinc-900`、`border-white/5`）；区块用卡片式（圆角、边框、内边距）。  
  - 遵循 **frontend-design**：字体层级清晰（标题/正文/辅助），可选非通用字体；色彩与现有 admin 一致，强调可读对比度。  
  - 遵循 **ui-ux-pro-max**：无 emoji 图标，用 SVG（如 Heroicons/Lucide）；焦点环可见；`prefers-reduced-motion` 下减少动效；正文 16px、行高 1.5–1.75。
- [ ] **3.4** 请求体展示：若 `changes` 为 JSON 字符串，先 `JSON.parse` 再格式化显示（可考虑 `<pre>` + 语法高亮或朴素缩进）；提供「复制」按钮（可选），复制失败时给出提示。
- [ ] **3.5** 空状态：当 `changes` 为空时显示「无请求体」或等价文案，不留空白歧义。
- [ ] **3.6** 可访问性：抽屉打开时焦点移入抽屉、关闭时回到触发按钮；确保标题与区块有语义化标题/标签；按钮具备 `aria-label`（若图标按钮）。
- [ ] **3.7** 响应式：小屏下抽屉宽度使用 100% 或 max-width 避免溢出；内容不产生横向滚动（长 URL/JSON 可断行或横向滚动仅限预格式化区域）。
- [ ] **3.8** 与现有项目 Drawer 用法一致：参考 `apps/frontend/src/views/projects/[id].vue` 中 `n-drawer` / `n-drawer-content` 的写法，保持 API 与样式风格统一。

### 阶段 4：文案与验收

- [ ] **4.1** 补全 i18n：抽屉标题、区块标题（基本信息、请求 URL、请求体、请求头、响应体）、空状态与「暂无数据」、复制成功/失败提示等，中英文一致。
- [ ] **4.2** 按 Pre-Delivery 清单自检：无 emoji 图标、可点击元素有 `cursor-pointer`、焦点可见、对比度与 reduced-motion、无内容被固定栏遮挡、无多余横向滚动。
- [ ] **4.3** 在 `/admin/audit-logs` 手动测试：列表刷新、点击不同行的「查看详情」、关闭抽屉、键盘 Tab/Enter、窄屏下抽屉展示与滚动。

---

## 四、关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/frontend/src/views/admin/audit-logs/index.vue` | 修改 | 增加操作列、详情按钮、抽屉状态与抽屉内容 |
| `apps/frontend/src/api/audit-log.ts` | 修改 | 扩展 `AuditLogDto`（如 `targetId`, `changes`；可选 `requestHeaders`, `responseBody`）；可选 `getAuditLogById` |
| `apps/frontend/src/i18n/locales/zh-CN.ts` | 修改 | `admin.auditLogs` 下增加 viewDetail、colOperations、抽屉标题与区块文案 |
| `apps/frontend/src/i18n/locales/en-US.ts` | 修改 | 同上英文 |
| `apps/api/src/modules/resources/audit-logs/audit-logs.service.ts` | 修改 | 列表返回 `resource: targetId`；可选 `findOne(id)` |
| `apps/api/src/modules/resources/audit-logs/audit-logs.controller.ts` | 修改 | 可选 GET `:id` |
| `apps/api/prisma/schema.prisma` | 修改 | 仅当本迭代要存请求头/响应体时增加字段 |
| `apps/api/src/common/interceptors/audit-log.interceptor.ts` | 修改 | 仅当本迭代写入请求头/响应体时 |

---

## 五、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 列表未返回 `resource` 导致目标资源列为空 | 后端在格式化时增加 `resource: item.targetId`；前端用 `targetId ?? resource` 兜底。 |
| `changes` 为大 JSON 导致渲染卡顿 | 使用虚拟滚动或折叠默认只展示前 N 行；或仅「复制」不强制全文展开。 |
| 后续要展示请求头/响应体但未留扩展点 | 后端预留字段与接口；前端用可选区块（有数据则展示，无则隐藏）。 |
| 设计风格与现有 admin 不一致 | 实施前跑 ui-ux-pro-max design-system（admin/dashboard 深色），并对照 frontend-design 做一次小评审。 |

---

## 六、设计系统参考（实施时执行）

实施阶段 3 前建议执行（在具备 ui-ux-pro-max 技能目录的前提下）：

```bash
# 设计系统（若脚本在 skills 或 .agents 中）
python3 skills/ui-ux-pro-max/scripts/search.py "admin dashboard audit log dark" --design-system -p "Audit Log Detail"
# 或
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "admin dashboard dark" --design-system -p "Audit Log"
```

用于获取：配色、字体、间距、圆角、动效时长、可访问性要点，并与现有 admin 深色风格合并使用。

---

**文档版本**：v1  
**规划日期**：2025-03-06
