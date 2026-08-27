# Chat Web Skyline Service instructions

本仓库继承 `F:/chat-web-service/AGENTS.md` 的通用微服务规约，并补充以下约束。

## 当前工程边界

- 当前代码为 NestJS 11 初始化后的空项目，只保留默认首页、`/health/live` 和 `chat-web-base-schema` 提供的 Nacos 配置与服务注册能力。
- `@nestjs/typeorm`、`typeorm` 与 `redis` 仅作为 `chat-web-base-schema` 的对等依赖安装；在新业务方案确定前，不得创建数据库/Redis 连接或恢复相关业务模块。
- 在新业务方案确定前，不得恢复 Vue、SSR、Webpack、Vite 或其他业务依赖。
- 新功能继续在 `developer` 分支开发；普通功能完成后只提交并推送 `developer`，不得立即合并 `main` 或触发流水线。

## 部署边界

- 保留现有 Home Docker 自动部署、`skyline.lisfes.com` 域名、独立 Runner、健康检查和失败回滚。
- Company 机器离线期间不创建 Company 部署任务；恢复双机部署必须重新启用 `chat-server-company` 和 `production-company`。
- 容器继续使用非 root 用户、`chat-web-service` Compose 项目和 `chat-web-infrastructure` 外部网络。
- 修改 Docker、Actions、Runner、域名、端口或健康检查时，必须同步更新 `deploy/CHANGELOG.md` 与 `deploy/RUNBOOK.md`。
