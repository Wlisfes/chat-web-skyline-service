# Chat Web Skyline Service instructions

## 默认双机部署规则

- `E:\chat-web-service` 下所有需要 Docker 自动部署的新旧服务，默认同时部署到 Company 和 Home 两台独立机器。Company Runner 标签固定为 `chat-server-company`，Home Runner 标签固定为 `chat-server-home`。只有用户明确批准单机例外时，才允许移除其中一台。
- GitHub Actions 必须只构建并发布一次镜像，并将同一个完整 Git SHA 镜像部署到两台机器；禁止两台机器各自构建可能不同的 `latest` 版本。
- 部署阶段使用矩阵，包含 `company / chat-server-company / production-company` 和 `home / chat-server-home / production-home`。矩阵必须设置 `fail-fast: false`，并使用按机器隔离的 `deploy-${server}` concurrency，使某台机器离线、排队或失败时不影响另一台。
- 每个服务仓库在两台机器上分别安装该仓库专用的 Self-hosted Runner。每个服务使用独立部署目录 `/opt/<repository-name>`；不得让不同服务覆盖同一个部署目录。
- 服务默认加入外部 Docker 网络 `chat-web-infrastructure`，Compose 项目名使用 `chat-web-service`。新增服务不得自动重建、删除或接管已经存在的 MySQL、Redis、RabbitMQ、Nacos 等基础设施容器。
- 两台机器的部署都必须有容器健康检查、部署后端点验证和失败自动回滚。机器离线时任务应保留等待，Runner 恢复后继续部署对应的精确 SHA。

## 部署记录

- 任何影响 Docker、Actions Workflow、Runner、Environment、部署目录、端口、健康检查、回滚、Nacos 或外部网络的改动，都必须同步更新对应仓库的 `deploy/CHANGELOG.md` 和必要的 `deploy/RUNBOOK.md`。
- 变更记录至少包含日期、影响机器、关联版本、变更内容、机器侧操作、验证命令和回滚方法。禁止记录密码、Token、私钥或完整 `.env`。
- 新服务首次接入部署时必须在仓库 `AGENTS.md` 中复制并保留本规则的“双机部署”约束，确保仓库被单独克隆后仍按 Company/Home 双机基线维护。

## 服务数据边界

- 每个业务服务必须使用独立 MySQL 数据库和独立 MySQL 账号。当前 Account 数据库为 `chat_web_account`，Finance 数据库为 `chat_web_finance`；账号只允许访问本服务数据库，不得拥有 `*.*` 全局权限、其他业务库权限或可继承跨库权限的角色。数据库由外部基础设施预创建，业务服务和 Schema 升级器不得执行 `CREATE DATABASE`。
- 每个业务服务必须使用独立 Redis index。Account 固定 index `0`，Finance 固定 index `1`；后续服务接入时必须分配未占用 index。即使使用 `REDIS_URL`，也必须通过显式 `REDIS_DATABASE` 强制本服务 index，禁止读取或修改其他服务的键。
- 业务服务不得导入其他服务的 Entity、连接其他服务数据库、执行跨业务库 SQL，或复用其他服务的 Redis 会话/缓存。跨服务数据访问统一通过带明确请求/响应类型的 HTTP 客户端 Provider（NestJS 中作为 Feign 等价方案）完成。
- Account 是登录会话与身份状态的唯一所有者。其他服务不得持有 Account JWT 密钥或读取 Account Redis 会话；应把 Bearer Token 转发到 Account 内部鉴权接口获取 `AuthPrincipal`。
- 部署和运行手册必须记录本服务数据库名、数据库账号权限校验命令、Redis index、上游服务地址、验证方式与回滚方式，且不得记录真实账号密码。

## Skyline 当前部署边界

- Skyline 已进入 Docker 自动部署阶段，必须保留 `Dockerfile`、Compose、GitHub Actions、独立 Runner、健康检查、失败回滚和 `deploy/` 运行文档。
- 用户已明确批准当前只部署 Home；Company 机器离线期间不创建或等待 Company 部署任务。恢复双机部署必须重新启用 `chat-server-company`、`production-company` 和独立 concurrency，且仍只构建一次完整 SHA 镜像。
- Skyline 不连接 MySQL、Redis 或其他有状态基础设施，因此不分配数据库、数据库账号或 Redis index；Nacos Data ID 只保留 `server.port`。
- Skyline 运行时必须连接 Nacos，直接使用共享 `NacosModule`；不得恢复独立的 `src/config` 目录或通过 `NACOS_CONFIG_ENABLED` 绕过共享模块。

## 协作与确认

- 对意图明确、范围小、低风险且可轻易回滚的改动，Codex 应自行判断并直接完成，不得要求用户逐步确认设计、计划或执行细节。
- 只有在需求存在会显著改变结果的歧义，或操作涉及破坏性变更、敏感信息、生产环境、外部系统状态、不可逆操作或明显扩大任务范围时，才向用户请求确认。
- 自主执行不降低质量要求；仍须保护用户现有改动、执行与风险相称的测试，并清楚报告实际修改和验证结果。
