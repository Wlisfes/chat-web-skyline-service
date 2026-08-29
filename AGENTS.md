# Chat Web Skyline Service instructions

本仓库继承 `F:/chat-web-service/AGENTS.md` 的通用微服务规约，并补充以下约束。

## 修改范围

- 用户只点名 `chat-web-skyline-service` 时，只修改本仓库，不得联动修改其他消费服务；确需扩大范围时必须先获得用户明确同意。

## 当前工程边界

- 当前代码为 NestJS 11 初始化后的空项目，只保留默认首页、`/health/live` 和 `chat-web-base-schema` 提供的 Nacos 配置与服务注册能力。
- `@nestjs/typeorm`、`typeorm` 与 `redis` 仅作为 `chat-web-base-schema` 的对等依赖安装；在新业务方案确定前，不得创建数据库/Redis 连接或恢复相关业务模块。
- 在新业务方案确定前，不得恢复 Vue、SSR、Webpack、Vite 或其他业务依赖。
- 新功能继续在 `developer` 分支开发；普通功能完成后只提交并推送 `developer`，不得立即合并 `main` 或触发流水线。

## 部署边界

- 只部署到当前主机 `chat-home-server`，使用 `chat-home-server` Runner 标签和 `production-home` Environment；原另一台部署机器已废弃并下线，不得恢复多机部署任务。
- 保留 `skyline.lisfes.com` 域名、本仓库独立 Runner、健康检查和失败回滚。
- 容器继续使用非 root 用户、`chat-web-service` Compose 项目和 `chat-web-infrastructure` 外部网络。
- 修改 Docker、Actions、Runner、域名、端口或健康检查时，必须同步更新 `deploy/CHANGELOG.md` 与 `deploy/RUNBOOK.md`。

## Git 提交规范

- 所有提交信息必须使用 Conventional Commits 类型前缀，格式固定为 `<type>: 中文摘要`；如需填写作用域，使用 `<type>(<scope>): 中文摘要`。
- `type` 只能使用以下类型：`init`（项目初始化）、`feat`（添加新特性）、`fix`（修复缺陷）、`docs`（仅修改文档）、`style`（仅调整格式或样式）、`refactor`（代码重构）、`perf`（性能优化）、`test`（增加或调整测试）、`build`（构建或依赖变更）、`ci`（持续集成或部署配置）、`chore`（工程工具或其他维护性变更）。
- 提交摘要、正文和脚注必须使用中文；类型前缀保留上述英文小写关键字，代码标识符、命令和版本号可按实际需要保留原文。
- 每个提交应聚焦单一目的，摘要使用动词开头并准确说明影响范围，禁止使用 `update`、`modify` 等无意义描述或整句英文提交信息。
- 示例：`feat: 新增客户归属人筛选`、`fix: 修复 Nacos 服务注册失败`、`docs: 补充部署回滚说明`。
