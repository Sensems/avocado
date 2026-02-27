这是一份为你量身定制、整合了所有前期讨论与补充需求的完整版 PRD 文档。结构已经过重新梳理，你可以直接将这份 Markdown 文档导出或复制给开发团队进行评审。

# ---

**小程序私有化 CI/CD 构建平台需求规格说明书 (PRD)**

**文档版本**：v2.0.0 (Release Candidate)

**更新日期**：2026-02-26

**状态**：待开发评审

**文档密级**：内部公开

## ---

**1\. 项目概述 (Overview)**

### **1.1 业务背景与痛点**

当前团队在小程序多人协作开发模式下，面临以下严重影响研发效能的问题：

1. **环境抢占冲突**：多分支并行开发时，频繁抢占唯一的“体验版”名额，导致测试人员扫码进入的版本不可控。  
2. **发布流程繁琐**：构建新版本需手动切换分支、本地编译、截图发群。依赖开发人员本地环境（如 Node 版本差异）易导致产物不一致。  
3. **资产与密钥分散**：Git 密钥和微信 upload.key 散落在各开发者电脑中，存在极大的安全隐患；构建产物无历史留存，无法快速回滚。  
4. **框架支持单一**：现有的零散脚本无法统一处理原生小程序与 Uni-app 项目的编译差异。

### **1.2 产品核心目标**

构建一套\*\*私有化部署（Self-Hosted）\*\*的小程序 DevOps 平台，实现：

* **权限与资产收口**：全局统管账户角色、Git 凭证、IM 通知机器人。  
* **构建自动化与资源池化**：自动调度微信 CI 机器人（Robot 1-30），解决并发冲突；支持原生与 Uni-app 框架。  
* **过程透明与可追溯**：提供流式构建日志，自动保留历史产物，全程记录操作审计日志。

## ---

**2\. 用户画像 (User Personas)**

| 角色 | 典型行为 | 核心诉求 |
| :---- | :---- | :---- |
| **系统管理员 (Super Admin)** | 统管用户账号、配置全局凭证库与存储策略。 | 资产绝对安全，系统运行稳定，资源分配合理。 |
| **项目负责人 (Maintainer)** | 创建项目、绑定凭证与通知机器人、管理项目成员。 | 灵活配置多环境流程，隔绝非核心人员接触密钥。 |
| **普通开发者 (Developer)** | 提交代码、触发构建、查看实时日志排查报错。 | 构建速度快，报错信息清晰，无需手动发二维码。 |
| **测试/产品 (QA/PM/Guest)** | 接收 IM 通知、扫码体验、下载历史版本。 | 随时能找到对应功能的稳定版本进行体验或回归。 |

## ---

**3\. 系统架构与业务流 (Architecture)**

### **3.1 核心实体关系逻辑 (ER-Like Diagram)**

代码段

graph TD  
    subgraph Account\_System \[账户与权限体系\]  
        User\[用户\] \--\>|拥有| SysRole\[全局角色: Admin/普通用户\]  
        User \--\>|分配加入| Project\[小程序项目\]  
        Project \--\>|赋予成员| ProjRole\[项目角色: Maintainer/Developer/Guest\]  
    end

    subgraph Resource\_Center \[资源管理中心\]  
        GitCred\[Git 凭证库\]  
        IMBot\[IM 通知机器人\]  
    end

    subgraph Project\_Context \[项目域\]  
        Project \--\>|1. 引用凭证| GitCred  
        Project \--\>|2. 绑定渠道| IMBot  
    end

    subgraph Execution\_Engine \[执行引擎\]  
        Queue\[FIFO 等待队列\]  
        Scheduler\[智能调度器\]  
        RobotPool\[CI 机器人池 ID: 1-30\]  
        Runner\[构建执行器 Docker\]  
    end

    Project \--\>|3. 触发任务| Queue  
    Queue \--\> Scheduler  
    Scheduler \--\>|4. 锁定空闲 ID| RobotPool  
    RobotPool \--\>|5. 执行任务| Runner  
      
    Runner \--\>|实时推送| LogStream\[WebSocket 流式日志\]  
    Runner \--\>|上传产物| Storage\[本地/OSS 存储\]  
    Runner \--\>|发送结果| IMBot

## ---

**4\. 功能需求详述 (Functional Requirements)**

### **4.1 账户与权限管理 (Account & RBAC)**

| ID | 功能名称 | 需求描述 (User Story) | 验收标准 (AC) | 优先级 |
| :---- | :---- | :---- | :---- | :---- |
| **A-01** | **账户生命周期** | Admin 可在后台创建、禁用账户及重置密码。 | 1\. 不开放公开注册。 2\. 账号禁用后立即强制下线，不可再登录，但保留关联审计数据。 3\. 密码必须加盐哈希（Bcrypt）存储。 | **P0** |
| **A-02** | **全局角色隔离** | 区分 Super Admin 与普通用户。 | 1\. **Super Admin**：可见所有菜单，管理全局凭证与所有项目。 2\. **普通用户**：仅可见“被拉入的项目”，无系统设置权限。 | **P0** |
| **A-03** | **项目级角色权限** | 项目 Maintainer 可向项目添加系统用户，并分配角色。 | 1\. **Maintainer**：可修改项目配置、框架、绑定资源。 2\. **Developer**：仅可触发构建、查看日志。 3\. **Guest**：仅可查看构建历史和扫码。 | **P0** |

### **4.2 资源管理中心 (Resource Management)**

| ID | 功能名称 | 需求描述 | 验收标准 | 优先级 |
| :---- | :---- | :---- | :---- | :---- |
| **R-01** | **Git 凭证管理** | 统一管理代码仓库访问凭证。 | 1\. 支持 SSH Private Key 和 HTTPS Token。 2\. 私钥入库 AES 加密，前端显示脱敏。 3\. 提供“连通性测试”按钮验证拉取权限。 | **P0** |
| **R-02** | **IM 机器人管理** | 独立维护企业微信、钉钉、飞书的 Webhook。 | 1\. 必填：名称、Webhook URL。选填：加签 Secret。 2\. 提供“发送测试消息”按钮。 | **P0** |

### **4.3 项目配置管理 (Project Configuration)**

| ID | 功能名称 | 需求描述 | 验收标准 | 优先级 |
| :---- | :---- | :---- | :---- | :---- |
| **P-01** | **多框架配置** | 项目需区分原生小程序与 Uni-app。 | 1\. **原生**：默认无编译步骤。 2\. **Uni-app**：需必填 Build Command（如 npm run build:mp-weixin）和 Output Path（如 dist/build/mp-weixin）。 | **P0** |
| **P-02** | **资源组装** | 项目创建/编辑时，关联外部资源。 | 1\. 下拉单选：Git 凭证（必选）。 2\. 下拉多选：IM 通知机器人（可同时通知多个群组）。 | **P0** |
| **P-03** | **产物保留策略** | 控制磁盘空间占用。 | 1\. 默认仅保留最近 10 个版本的构建产物（源码包、二维码）。 2\. 超出数量时自动执行物理删除。 | **P1** |

### **4.4 构建流水线 (Build Pipeline)**

| ID | 功能名称 | 需求描述 | 验收标准 | 优先级 |
| :---- | :---- | :---- | :---- | :---- |
| **B-01** | **智能调度池** | 后端隐式维护 Robot 1-30 状态池。 | 1\. 并发构建时，分配不同 Robot ID 避免覆盖。 2\. 机器人全忙时，任务进入 FIFO 队列等待。 3\. 构建结束/异常中断必须释放占用的 ID。 | **P0** |
| **B-02** | **版本号自动注入** | 自动管理每次构建的唯一版本号。 | 1\. 格式：Major.Minor.Patch.{BuildID}。 2\. 构建前重写 package.json 或 project.config.json，确保微信后台版本号一致。 | **P1** |
| **B-03** | **流式日志终端** | 实时查看构建全过程输出（类似 Jenkins）。 | 1\. 通过 WebSocket/SSE 推送日志，前端黑色终端样式展示。 2\. 覆盖：Git Pull \-\> Npm Install \-\> Compile \-\> Upload。 3\. 持久化至数据库/文件备查。 | **P0** |
| **B-04** | **触发机制** | 支持手动触发与代码推送触发。 | 1\. **手动**：前端点击按钮。 2\. **Git Webhook**：监听 Push/MR，支持过滤包含特定关键词（如 \[build\]）的 Commit。 | **P1** |

### **4.5 审计与系统 (Audit & System)**

| ID | 功能名称 | 需求描述 | 验收标准 | 优先级 |
| :---- | :---- | :---- | :---- | :---- |
| **S-01** | **操作审计日志** | 记录用户的关键写操作。 | 1\. 记录：操作人、时间、IP、动作（增删改）、目标、Diff 详情。 2\. 仅 Super Admin 可查询全局审计日志。 | **P1** |
| **S-02** | **存储驱动适配** | 系统级产物存储配置。 | 支持切换为服务器本地磁盘 (Local) 或 兼容 S3 协议的对象存储。 | **P2** |

## ---

**5\. 数据库模型设计 (Database Schema)**

核心表结构及关联关系如下：

### **5.1 账户与权限域**

* **users**  
  * id: UUID (PK)  
  * username: Varchar (Unique)  
  * password\_hash: Varchar (Bcrypt)  
  * is\_super\_admin: Boolean (Default: false)  
  * status: Enum (active, disabled)  
* **project\_members**  
  * id: UUID (PK)  
  * project\_id: FK \-\> projects.id  
  * user\_id: FK \-\> users.id  
  * role: Enum (maintainer, developer, guest)

### **5.2 资源域**

* **git\_credentials**  
  * id: UUID (PK)  
  * name, type (ssh/https), username  
  * secret: Text (AES Encrypted)  
  * created\_by: FK \-\> users.id  
* **im\_robots**  
  * id: UUID (PK)  
  * name, platform (wecom/dingtalk/feishu)  
  * webhook\_url: Text  
  * secret\_token: Varchar (AES Encrypted)  
  * created\_by: FK \-\> users.id

### **5.3 项目与构建域**

* **projects**  
  * id: UUID (PK)  
  * name, app\_id, repo\_url  
  * framework: Enum (native, uniapp)  
  * build\_command, dist\_path  
  * git\_credential\_id: FK \-\> git\_credentials.id  
  * retention\_count: Int (Default: 10\)  
  * im\_robot\_ids: JSON (Array of mapped IM bots)  
* **build\_tasks**  
  * id: BigInt (Auto Increment)  
  * project\_id: FK \-\> projects.id  
  * trigger\_user\_id: FK \-\> users.id  
  * status: Enum (pending, running, success, failed, canceled)  
  * robot\_id: Int (1-30)  
  * version, commit\_hash  
  * log\_path, artifact\_path, qrcode\_path

### **5.4 审计域**

* **audit\_logs**  
  * id: UUID (PK)  
  * user\_id: FK \-\> users.id  
  * action: Varchar (e.g., UPDATE\_PROJECT)  
  * target\_id: Varchar  
  * changes: JSON  
  * ip\_address: Varchar  
  * created\_at: Timestamp

## ---

**6\. 非功能性需求 (NFR)**

1. **安全性隔离**：  
   * 构建过程必须在独立的沙箱（如临时 Docker 容器或独立进程）中执行，任务结束后清理源码目录，防止源码泄露和交叉污染。  
   * API 接口必须全面覆盖鉴权拦截，越权访问直接返回 403。  
2. **性能与并发**：  
   * 至少支持 10 个项目同时进行构建（视服务器配置而定），队列积压不丢失。  
   * WebSocket 日志推送延迟低于 500ms。  
3. **部署支持**：  
   * 提供 docker-compose.yml，一键拉起后端服务、前端静态资源、数据库（MySQL/PostgreSQL）及 Redis（用于队列和 WebSocket 状态订阅）。

## ---

**7\. 页面交互流转 (UI/UX Flow Map)**

为了前端团队快速构建路由和页面骨架，梳理页面流转如下：

* **1\. 登录与大盘**  
  * /login \-\> 账密登录  
  * /dashboard \-\> 工作台（展示排队任务、最新构建动态、我参与的项目卡片）  
* **2\. 资源与系统配置 (Super Admin 或可见)**  
  * /admin/users \-\> 用户管理（增删改查、禁用、重置密码）  
  * /admin/credentials \-\> Git 凭证库（录入密钥、连通测试）  
  * /admin/robots \-\> IM 通知机器人（录入 Webhook、发送测试消息）  
  * /admin/audit-logs \-\> 全局操作审计日志  
* **3\. 项目管理与构建**  
  * /projects \-\> 项目列表（创建项目入口）  
  * /projects/:id \-\> 项目详情聚合页  
    * **Tab 1: 构建历史** \-\> 产物下载、查看结果、触发构建入口。  
    * **Tab 2: 实时日志** \-\> 点击某次构建后进入的黑色 Console 界面。  
    * **Tab 3: 成员管理** \-\> （需 Maintainer）分配项目成员及角色。  
    * **Tab 4: 项目设置** \-\> （需 Maintainer）修改框架、编译命令、绑定凭证与机器人。

---

**\[文档结束\]**

如果你需要开始落实开发，下一步我们可以针对**技术栈选型**或\*\*核心接口设计（Swagger 定义）\*\*进行探讨。需要我帮你出具接口草案吗？