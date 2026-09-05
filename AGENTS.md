# Chat Web Skyline Service instructions

本文件包含本仓库需要遵守的完整规则，不依赖 `F:/chat-web-service/AGENTS.md` 或其他工作区文件。

## 通用工程规则

- 使用 Node.js 22、Yarn 1.22.22、NestJS 11 和 TypeScript；源码使用 UTF-8，Shell、YAML 和 Dockerfile 使用 LF。
- 统一使用 4 空格、无分号、单引号、`printWidth: 140`、无尾随逗号；内部源码统一使用 `@/*` 路径别名。
- 文件名使用小写 kebab-case 和职责后缀；类、接口、枚举使用 PascalCase，变量、函数使用 camelCase，常量和注入 Token 使用 UPPER_SNAKE_CASE。
- 日志、校验消息、Swagger 描述和面向维护者的错误信息使用中文，代码标识符使用英文。
- 业务源码和配置文件必须编写清晰、必要的中文注释；配置文件包括 Nacos YAML、Compose、Dockerfile、Actions 和 `.env.example`。新增配置项必须同步说明用途，修改或格式化时必须保留既有注释，不得删除、覆盖或改写；注释中不得出现真实密码、Token、私钥等敏感信息。
- HTTP Controller 只允许 GET、POST；GET 使用 query，POST 使用 body；多选参数必须是数组，禁止使用 `/:uid` 等路径参数。
- 如新增分页接口，必须使用统一的 `page`、`size` 入参和 `page`、`size`、`total`、`list` 响应；不得引入 `pageSize`、`items`、`records` 或 `rows` 同义字段。
- 请求日志必须包含 logId、方法、URL、状态码、来源、入参和耗时，并脱敏密码、Token 等敏感字段。
- `.env.example` 只列出启动所需参数和明确占位符；真实密钥、Token、私钥和生产 `.env` 不得提交。
- 每次改动至少执行格式检查、TypeScript 类型检查和 Nest 构建；涉及服务发现或部署时增加运行级验证。

## 修改范围

- 用户只点名 `chat-web-skyline-service` 时，只修改本仓库，不得联动修改其他消费服务；确需扩大范围时必须先获得用户明确同意。

## 当前工程边界

- Skyline 服务包含系统任务管理（`src/modules/datetask/`）和 Skyline 专属 MySQL 数据库连接（`src/modules/database/`），同时保留默认首页、`/health/live` 以及 `chat-web-base-schema` 提供的 Nacos 配置与服务注册能力。
- `TbSkylineDatetaskSystem` Entity、完整 DTO、建表 SQL 和增量 SQL 必须来自 `@wlisfes/chat-web-base-schema/chat-web-skyline-mysql`；业务服务只注册实体和编排用例，不得复制或自行维护另一套表结构。TypeORM 必须使用 `synchronize: false`，数据库变更由版本化 Schema SQL 和部署前的 `yarn schema:apply` 完成。
- 系统任务定义由服务启动时幂等初始化，管理页面只允许查询、启停、修改 Cron、手动触发和查看执行日志，不提供新增或删除接口。新增内置任务必须同时补充 Schema/初始化定义、处理器映射、DTO、接口文档和测试。
- 任务调度器必须以数据库中的任务状态和 Cron 为准；多 Pod 场景使用 MySQL 会话级分布式锁，确保同一任务不会重复执行。调度失败要记录中文日志并保留可恢复的重试行为，不能因为单个任务异常产生未处理 Promise 拒绝。
- 汇率同步任务通过 `FeignClientFinance` 调用 Finance 服务 `/currency/exchange/sync`，外部汇率数据从 Frankfurter 获取。Feign 客户端统一复用 `chat-web-base-schema`，不得在 Skyline 中另写 HTTP 客户端契约；自动调度没有请求上下文时使用 Nacos `feign.service_token`（兼容历史 `security.serviceToken`），凭据不得写入代码、日志或文档示例。
- 入口认证由网关调用 `chat-web-auth-service` 的 `/internal/auth/token/introspect` 完成，Skyline 只通过共享 `GatewayPrincipalModule` 校验身份上下文；Finance Feign 地址和超时读取 Nacos `feign.chat-web-finance.url/timeout`，不得使用或新增 `feign.gateway` 地址。
- 本服务不恢复 Vue、SSR、Webpack、Vite 或其他前端业务依赖；管理页面属于 `chat-web-base-manager`，通过 Gateway `/api/skyline/**` 访问 Skyline 接口。
- 新功能继续在 `developer` 分支开发；普通功能完成后只提交并推送 `developer`，不得立即合并 `main` 或触发流水线。
- 远程仓库只保留 `main`、`developer` 两个长期分支；临时需求分支必须先合并到 `developer`，发布时同步合并到 `main`，合并并验证通过后立即删除远程和本地临时分支。

## HTTP Controller 与 Service 编码基准

- `chat-web-account-service/src/modules/sheet/` 是 Controller、Service、DTO、Utils Service 和 Module 组织方式的唯一基准；Skyline 按 NestJS 空项目边界适配，不得另建接口风格。
- Controller 必须保持为薄协议层：只声明路由、权限、Swagger/Apifox 元数据，接收 `query`、`body` 或必要请求/响应上下文，并将参数原样交给同名 Service 方法；禁止在 Controller 内实现业务判断、业务数据组装或记录业务日志。Cookie、响应头、重定向和流式响应等纯 HTTP 协议操作可以留在 Controller，但不得把 `Request`、`Response` 或响应发送逻辑传入业务 Service。
- Controller 与对应 Service 的公开 HTTP 方法统一声明为 `public async`；CRUD、列表等通用动作通常使用 `httpBaseSkyline<Action><Resource>`，Tree、Resolver 等资源专属读取语义可使用 `httpBaseSkyline<Resource><Action>`，命名语义参考基准模块的 `httpBaseAccountSheetTree`、`httpBaseAccountSheetResolver`。两层方法名必须完全一致，不得只为统一单词顺序而机械倒装；Controller 直接返回同名 Service 调用结果，禁止再调用 `create`、`list`、`findOne`、`update` 等另一套短方法。
- GET 只接收 `@Query()` DTO，POST 只接收 `@Body()` DTO；无请求 DTO 的接口不制造空 DTO。每个接口必须使用 `ApiServiceDecorator` 完整声明请求来源、请求 DTO、响应 DTO、数组标识和中文说明；纯文本、文件流等原始响应必须明确关闭统一响应外壳。
- Service 负责业务编排，公开 HTTP 方法必须添加简洁中文职责注释并显式声明 `Promise<...>` 返回类型；欢迎信息和健康检查响应都由 Service 返回，Controller 不得内联常量或对象。模块请求 DTO 在 Service 中优先使用 `import * as XxxDto` 归组引用。
- DTO 和接口枚举放在模块 `dto/` 目录，优先通过共享基础 DTO 复用字段；字段必须提供 Swagger 示例/说明、必要的类型转换和中文校验消息。分页 DTO 使用公共 `PageDto`，响应固定为 `page`、`size`、`total`、`list`。
- 若项目数据边界允许实体查询，必须优先使用公共 `DataBaseService.builder`，QueryBuilder 别名固定为 `t`；禁止重复封装 QueryBuilder 或创建无意义 Repository Adapter。
- 仅当查找、校验、锁、树结构或可复用转换形成独立职责时才创建 `<module>.utils.service.ts`，使用 `@Injectable()` 并由 Module 注册注入；仅调用一次且无复用价值的简单步骤不得机械拆成 Utils Service，当前空项目的欢迎信息和健康检查尤其不得为了形式制造 Utils Service。Module 按 `imports`、`controllers`、`providers`、`exports` 组织。
- 普通业务可选入参统一使用 `class-validator` 的 `isEmpty`、`isNotEmpty` 判空，禁止手写 `input.xxx !== undefined && ...` 或用隐式 truthy/falsy 代替。只有必须区分“未传、显式 null、具体值”的三态字段可以直接判断 `undefined`，且必须紧邻中文语义说明；基础设施配置、协议、第三方返回值、布尔值、集合长度及已确认非空值比较不受此限制。
- 重构不得改变 `/`、`/health/live` 路由、HTTP 状态、首页纯文本响应、健康响应结构和 Nacos 注册行为。

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
