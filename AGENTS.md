# Chat Web Skyline Service instructions

本文件包含本仓库需要遵守的完整规则，不依赖 `F:/chat-web-service/AGENTS.md` 或其他工作区文件。

## 通用工程规则

- 使用 Node.js 22、Yarn 1.22.22、NestJS 11 和 TypeScript；源码使用 UTF-8，Shell、YAML 和 Dockerfile 使用 LF。
- 统一使用 4 空格、无分号、单引号、`printWidth: 140`、无尾随逗号；内部源码统一使用 `@/*` 路径别名。
- 文件名使用小写 kebab-case 和职责后缀；类、接口、枚举使用 PascalCase，变量、函数使用 camelCase，常量和注入 Token 使用 UPPER_SNAKE_CASE。
- 日志、校验消息、Swagger 描述和面向维护者的错误信息使用中文，代码标识符使用英文。
- HTTP Controller 只允许 GET、POST；GET 使用 query，POST 使用 body；多选参数必须是数组，禁止使用 `/:uid` 等路径参数。
- 请求日志必须包含 logId、方法、URL、状态码、来源、入参和耗时，并脱敏密码、Token 等敏感字段。
- `.env.example` 只列出启动所需参数和明确占位符；真实密钥、Token、私钥和生产 `.env` 不得提交。
- 每次改动至少执行格式检查、TypeScript 类型检查和 Nest 构建；涉及服务发现或部署时增加运行级验证。

## 修改范围

- 用户只点名 `chat-web-skyline-service` 时，只修改本仓库，不得联动修改其他消费服务；确需扩大范围时必须先获得用户明确同意。

## 当前工程边界

- 当前代码为 NestJS 11 初始化后的空项目，只保留默认首页、`/health/live` 和 `chat-web-base-schema` 提供的 Nacos 配置与服务注册能力。
- `@nestjs/typeorm`、`typeorm` 与 `redis` 仅作为 `chat-web-base-schema` 的对等依赖安装；在新业务方案确定前，不得创建数据库/Redis 连接或恢复相关业务模块。
- 在新业务方案确定前，不得恢复 Vue、SSR、Webpack、Vite 或其他业务依赖。
- 新功能继续在 `developer` 分支开发；普通功能完成后只提交并推送 `developer`，不得立即合并 `main` 或触发流水线。
- 远程仓库只保留 `main`、`developer` 两个长期分支；临时需求分支必须先合并到 `developer`，发布时同步合并到 `main`，合并并验证通过后立即删除远程和本地临时分支。

## 部署边界

- 只部署到当前主机 `chat-home-server`，使用 `chat-home-server` Runner 标签和 `production-home` Environment；原另一台部署机器已废弃并下线，不得恢复多机部署任务。
- `skyline.lisfes.com` 已废弃；所有公开请求统一由 Gateway `/api/skyline/**` 转发，本仓库保留独立 Runner、健康检查和失败回滚。
- 容器继续使用非 root 用户、`chat-web-service` Compose 项目和 `chat-web-infrastructure` 外部网络。
- 修改 Docker、Actions、Runner、域名、端口或健康检查时，必须同步更新 `deploy/CHANGELOG.md` 与 `deploy/RUNBOOK.md`。

## Git 提交规范

- 所有提交信息必须使用 Conventional Commits 类型前缀，格式固定为 `<type>: 中文摘要`；如需填写作用域，使用 `<type>(<scope>): 中文摘要`。
- `type` 只能使用以下类型：`init`（项目初始化）、`feat`（添加新特性）、`fix`（修复缺陷）、`docs`（仅修改文档）、`style`（仅调整格式或样式）、`refactor`（代码重构）、`perf`（性能优化）、`test`（增加或调整测试）、`build`（构建或依赖变更）、`ci`（持续集成或部署配置）、`chore`（工程工具或其他维护性变更）。
- 提交摘要、正文和脚注必须使用中文；类型前缀保留上述英文小写关键字，代码标识符、命令和版本号可按实际需要保留原文。
- 每个提交应聚焦单一目的，摘要使用动词开头并准确说明影响范围，禁止使用 `update`、`modify` 等无意义描述或整句英文提交信息。
- 示例：`feat: 新增客户归属人筛选`、`fix: 修复 Nacos 服务注册失败`、`docs: 补充部署回滚说明`。
