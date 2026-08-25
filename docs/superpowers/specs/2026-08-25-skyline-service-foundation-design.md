# Chat Web Skyline Service 基础框架设计

日期：2026-08-25  
状态：已完成方案确认，等待书面规格复核

## 1. 目标

在独立目录 `chat-web-skyline-service` 中搭建一个可本地开发、生产构建和验证的服务端渲染基础框架。框架采用 `ssr` 7 的官方 NestJS + Vue3 组织方式，由同一个 NestJS 进程承载页面 SSR、健康检查和未来的 BFF 接口，并集成 Naive UI 的服务端样式收集与客户端 Hydration。

首版成功标准：

- NestJS 11、Vue3、Naive UI 和 `ssr` 7 可在 Node.js 20 以上环境安装和构建。
- 首页首个 HTTP 响应包含 Vue 页面内容、Naive UI 组件标记及服务端收集的 `cssr-id` 样式。
- 浏览器 Hydration 不产生 mismatch，示例按钮可从 `0` 点击到 `1`。
- `/health/live` 和 `/health/ready` 可用于本地与未来的容器探针。
- 生产 SSR 失败时可降级为 CSR；两种渲染都失败时返回明确的 500 响应。
- 复用 `@wlisfes/chat-web-base-schema` 的 Nacos 和 Feign 公共能力，不在 Skyline 重复实现基础设施代码。

## 2. 首版范围

### 2.1 包含

- 独立 Git 仓库，初始分支为 `main`，日常开发分支为 `developer`。
- `ssr` 7 + NestJS 11 + Vue3 + Pinia + Naive UI SSR 骨架。
- Nacos-first 配置加载和服务注册。
- 独立的 SSR 渲染服务及 Naive UI 样式注入器。
- 首页技术验证页及按钮 Hydration 示例。
- 存活和就绪健康检查。
- 类型检查、单元测试、生产构建、SSR HTTP 集成测试和浏览器 E2E 测试入口。
- `.env.example`、README、仓库级 `AGENTS.md`。

### 2.2 不包含

- Dockerfile、Compose、GitHub Actions、Self-hosted Runner 或实际双机部署。
- `deploy/CHANGELOG.md` 与 `deploy/RUNBOOK.md`。首次引入部署文件时必须在同一次改动中创建并补全它们。
- MySQL、Redis、RabbitMQ 或其他有状态基础设施连接。
- 真实 Account 登录流程、业务接口或页面迁移。
- JWT 签发、JWT 密钥、Account Redis 会话读取。

## 3. 方案选择

采用 `ssr` 官方 `nestjs-vue3-ssr` 目录规范，由 NestJS 直接承载 Vue3 SSR。

未采用的方案：

- `apps/server` 与 `apps/web` 双应用：边界更明显，但偏离 `ssr` 官方默认结构，需要维护额外的构建和产物协调。
- Nuxt + Nest 双服务：Nuxt 的 SSR 生态更成熟，但不满足验证并采用 `ssr` 7 与 NestJS 直接组合的目标。

## 4. 仓库与分支

仓库在空目录中以 `main` 初始化。设计规格先提交到 `main` 形成基线；规格获得用户复核后，从 `main` 创建 `developer`，后续基础框架实现和验证均落在 `developer`。

首版不配置远程仓库，也不推送。后续配置 GitHub 远程和部署时，分支只保留 `main`、`master`（如果远端历史确实存在）和 `developer`。

## 5. 运行边界与配置

### 5.1 服务标识

- 包名和服务名：`chat-web-skyline-service`
- 本地监听端口：`4020`
- Nacos Data ID：`chat-web-skyline-service.yaml`
- Nacos Group：默认 `DEFAULT_GROUP`
- Nacos 服务注册名：`chat-web-skyline-service`

端口 `4020` 避开当前 Gateway `3999`、Account 本地 `4000` 和 Finance 本地 `4010`。

### 5.2 Nacos-first

Skyline 依赖明确版本的 `@wlisfes/chat-web-base-schema`，使用它导出的 `NacosModule` 和 `NacosService` 完成配置拉取、订阅和服务注册。启动顺序为：

1. 从环境变量读取 Nacos 连接和订阅所需的最小启动参数。
2. 创建 NestJS Application Context。
3. 在监听端口前完成 Nacos 配置加载。
4. 根据加载后的 `server.port` 或 `PORT` 启动 HTTP 服务。
5. 按公共 Nacos 运行时规则注册实例。

默认环境采用 Nacos-first。单元测试、构建测试和本地离线验证允许显式设置 `NACOS_CONFIG_ENABLED=false` 与 `NACOS_REGISTER_ENABLED=false`，但不得将关闭 Nacos 作为生产默认值。

`.env.example` 只包含占位值，不记录真实账号、密码、Token 或完整生产环境配置。

### 5.3 数据边界

首版没有业务数据库和 Redis，因此：

- 不创建数据库、不执行 `CREATE DATABASE`、不引入 ORM Entity。
- 不分配 Redis index，也不读取 Account index `0` 或 Finance index `1`。
- 将来 Skyline 确需自身数据库或缓存时，必须先分配独立数据库、账号和未占用 Redis index，并在部署规格中记录。
- 不导入其他服务 Entity，不执行跨库 SQL。

### 5.4 身份与跨服务访问

首版页面不依赖 Account、Finance 或 Gateway，以保证框架可独立启动。

未来受保护页面必须使用 `@wlisfes/chat-web-base-schema` 导出的强类型 `AccountFeignClient` 或同等公共 Provider，把浏览器传入的 `Authorization: Bearer ...` 原样转发给 Account 内部鉴权接口，并只接收 `AuthPrincipal`。Skyline 不持有 Account JWT 密钥，也不访问 Account Redis 会话。

其他业务数据也必须通过带明确请求和响应类型的 HTTP Feign Provider 获取。Skyline 不连接其他业务服务数据库。

## 6. 代码结构

```text
chat-web-skyline-service/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  └─ modules/
│     ├─ health/
│     │  ├─ health.controller.ts
│     │  └─ health.module.ts
│     ├─ skyline/
│     │  ├─ skyline.controller.ts
│     │  └─ skyline.module.ts
│     └─ ssr/
│        ├─ ssr.module.ts
│        ├─ ssr-renderer.service.ts
│        └─ naive-style-injector.ts
├─ web/
│  ├─ components/layout/
│  │  ├─ index.vue
│  │  └─ App.vue
│  ├─ pages/index/
│  │  ├─ render.vue
│  │  └─ fetch.ts
│  ├─ store/
│  └─ common.less
├─ test/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ docs/superpowers/specs/
├─ config.ts
├─ package.json
├─ tsconfig.json
├─ tsconfig.build.json
├─ .env.example
├─ AGENTS.md
└─ README.md
```

职责边界：

- `SkylineController` 只处理 HTTP 请求、响应头和降级结果，不解析或修改渲染 HTML。
- `SsrRendererService` 封装 `ssr-core`，对上层暴露 SSR 和 CSR 两种明确方法。
- `NaiveStyleInjector` 是无状态纯函数，只负责从渲染结果提取样式、移除收集占位节点并注入 `<head>`。
- `web/components/layout/App.vue` 为每个服务端请求收到的独立 Vue App 调用 `@css-render/vue3-ssr` 的 `setup()`，并在页面组件之后输出收集节点。
- `web/pages/index/render.vue` 只承担技术验证页面和 Hydration 交互，不含业务访问。

## 7. SSR 与 Naive UI 集成

### 7.1 构建配置

`config.ts` 的 `whiteList` 至少包含：

```ts
['naive-ui', 'vueuc', 'date-fns', '@css-render/vue3-ssr']
```

该配置等价于 Vite 的 `ssr.noExternal`，避免 `vueuc` 在 Node ESM 环境下以具名导入读取 CommonJS 输出失败。

项目显式声明 `naive-ui`、`@css-render/vue3-ssr`、`@swc/cli` 和 `@swc/core`。`@css-render/*` 与 `css-render` 必须在锁文件中解析到兼容且唯一的版本，避免多实例导致样式收集失效。

### 7.2 渲染流程

1. 请求进入 `SkylineController`。
2. Controller 调用 `SsrRendererService.renderSsr()`，使用 `stream: false` 获取完整 HTML。
3. `ssr-plugin-vue3` 为该请求创建独立 Vue App、Router、Store 和 Pinia。
4. Layout App 对该请求的 Vue App 调用 `setupCssRender(ssrApp)`。
5. 页面渲染 Naive UI 组件；位于页面之后的收集节点调用 `collect()`。
6. `NaiveStyleInjector` 提取收集节点中的 `<style cssr-id="...">`，将其插入 `<head>`，并删除原收集节点。
7. Controller 返回 HTML，并设置 `X-Render-Mode: ssr`。
8. 客户端 bundle 加载后，Vue 使用相同初始状态 Hydration；收集节点只在服务端输出。

Naive UI 样式必须在完整组件树渲染后才能收集，因此首版 SSR 不使用框架默认的流式输出。如果将来恢复流式响应，需要先为 `ssr-plugin-vue3` 增加正式的渲染完成/Head 注入钩子，不能退回首屏无样式的实现。

## 8. 页面设计

首页是简洁的 Skyline 技术验证页，包含：

- 服务名称和运行状态。
- `NestJS + Vue3 + Naive UI SSR` 技术标识。
- SSR/CSR 当前渲染模式展示。
- Naive UI Card、Alert、Button 等组件。
- 初始值为 `0` 的按钮计数器，点击后变为 `1`，用于证明 Hydration 已完成。
- 不包含登录、菜单系统、Account 信息或 Finance 数据。

页面使用 `NConfigProvider`，首版只提供确定性的默认主题。暗色主题和用户偏好持久化留到后续独立功能设计，以避免服务端与客户端初始主题不一致。

## 9. 健康检查

- `GET /health/live`：进程可以响应即返回 200，不检查外部依赖。
- `GET /health/ready`：NestJS 启动和 SSR 生产资源均准备完成时返回 200；缺少关键构建产物或渲染器未就绪时返回 503。

健康检查不调用 Account、Finance、数据库或 Redis，避免上游故障将 Skyline 实例错误标记为进程死亡。Nacos 配置在启动阶段是生产必需条件；加载失败时按公共运行时配置决定阻止启动或记录非必需注册错误。

## 10. 错误处理与降级

首页渲染遵循一次降级规则：

1. SSR 成功：返回 200 和 `X-Render-Mode: ssr`。
2. SSR 抛错：使用 NestJS Logger 记录结构化错误和请求路径，不输出 Token、Cookie 或完整请求头。
3. 尝试一次 CSR 渲染：成功后返回 200 和 `X-Render-Mode: csr`。
4. CSR 也失败：返回 500 和通用错误页面，不暴露堆栈或内部路径。

降级不得递归重试。SSR 响应不缓存带用户身份的 HTML；首版公开技术页不设置共享缓存策略，后续再按页面数据属性设计。

## 11. 测试设计

### 11.1 单元测试

`NaiveStyleInjector` 覆盖：

- 提取一个和多个 `cssr-id` 样式块。
- 将样式插入 `</head>` 前。
- 删除 `css-render-style` 占位节点。
- 未找到占位节点时给出明确错误，不静默返回首屏无样式页面。
- 缺少 `</head>` 时给出明确错误。

### 11.2 集成测试

- `/health/live` 返回 200。
- `/health/ready` 在渲染器就绪时返回 200。
- SSR 首页响应包含页面标识、按钮初始值、Naive UI class、至少一个 `<style cssr-id>` 和客户端 module bundle。
- SSR 首页不包含 `css-render-style` 占位节点。
- 模拟 SSR 异常后只降级一次，并返回 `X-Render-Mode: csr`。
- 模拟 SSR 与 CSR 同时失败后返回 500，响应中没有内部堆栈。

### 11.3 浏览器 E2E

- 生产构建后启动服务并访问首页。
- 浏览器控制台不存在 Hydration mismatch、warning 或 error。
- Naive UI 按钮可见，点击后文本从 `0` 变为 `1`。
- `<head>` 中存在 `style[cssr-id]`，页面中不存在样式收集占位节点。

### 11.4 命令

- `npm run typecheck`：检查 NestJS 和 Vue 类型。
- `npm run test:unit`：运行纯单元测试。
- `npm run build`：依次构建 Vue client、Vue SSR server 和 NestJS server，并在脚本层验证关键产物存在。不能只信任 `ssr build` 的退出码。
- `npm run test:integration`：基于生产产物启动临时端口并做 HTTP 断言。
- `npm run test`：执行 typecheck、unit、build 和 integration。
- `npm run test:e2e`：单独运行浏览器 Hydration 测试。

## 12. 部署规则的仓库级保留

虽然首版不创建部署文件，仓库 `AGENTS.md` 必须完整复制工作区的 Company/Home 双机部署约束及服务数据边界。后续首次部署必须同时满足：

- Company Runner：`chat-server-company`，Environment：`production-company`。
- Home Runner：`chat-server-home`，Environment：`production-home`。
- 镜像只构建、发布一次，两台机器部署同一完整 Git SHA。
- 部署矩阵 `fail-fast: false`，按 `deploy-${server}` 隔离 concurrency。
- 独立部署目录 `/opt/chat-web-skyline-service`。
- 外部网络 `chat-web-infrastructure`，Compose 项目名 `chat-web-service`。
- 不接管或重建 MySQL、Redis、RabbitMQ、Nacos 等基础设施容器。
- 两台机器都有健康检查、端点验证和失败自动回滚。
- Docker、Actions、Nacos、端口和健康检查等部署变更在同一次提交中更新 `deploy/CHANGELOG.md` 与必要的 `deploy/RUNBOOK.md`。

首版尚未引入这些部署变更，因此不虚构部署记录或机器侧验证结果。

## 13. 已知风险与控制

- `ssr` CLI 曾出现内部构建错误但进程退出码仍为 0：构建脚本必须额外检查 `dist/main.js`、client manifest 和 server bundle。
- `ssr` 7 构建过程可能输出 `MaxListenersExceededWarning`：首版记录并评估，不能通过扩大 listener 上限掩盖真实泄漏；若稳定复现，应在独立问题中定位上游行为。
- `ssr-vite` 会建议将 `vite` 映射到 `rolldown-vite`：依赖清单显式采用框架建议的映射并锁定版本，避免机器间隐式解析差异。
- Naive UI CSS-in-JS 会增加首屏 HTML 体积：首版以正确性为先，后续用真实页面数据评估样式缓存或内联策略。
- 自定义 HTML 字符串注入容易脆弱：逻辑集中在纯函数并通过异常输入测试；业务 Controller 不执行字符串替换。

## 14. 验收清单

- 仓库 `main` 基线提交存在，`developer` 从该基线创建。
- 安装和锁文件没有重复的 `css-render` 目标版本。
- `npm test` 通过并验证关键生产产物存在。
- `npm run test:e2e` 通过，按钮点击生效且控制台无 Hydration 错误。
- HTTP 首屏含 Naive UI 样式，SSR 失败时可观察到一次 CSR 降级。
- `AGENTS.md` 保留现有服务规则，代码未连接数据库或 Redis。
- 没有 Docker、Actions 或虚构部署记录。
