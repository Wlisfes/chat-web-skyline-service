# Skyline 部署变更记录

## 2026-09-04：升级共享基础包并统一 Nacos 数据库与 Feign 配置

- 影响范围：Skyline 本地启动与 `chat-home-server` 部署镜像。
- 变更内容：升级 `@wlisfes/chat-web-base-schema` 至 `1.4.25`，使用共享 `FeignClientFinance` 并直接读取 Nacos 嵌套配置；数据库运行时仅在内存中兼容历史 `name` 字段，不修改 Nacos；示例 `.env` 仅保留 Node/Nacos 启动参数。
- 验证命令：执行 `yarn build`、`yarn typecheck` 和 `yarn test:unit`，启动后检查 `/health/live`、`/health` 与 Swagger。

## 2026-09-03：本地 Nacos 客户端端口冲突自动避让

- `yarn dev`、`yarn start` 和 `yarn start:debug` 启动前优先检测默认端口 `7777`；检测到占用时自动随机选择本机可用端口并注入 `NODE_CLUSTER_CLIENT_PORT`。
- 该端口仅用于 Node 客户端进程协调，不属于 Nacos 业务配置；生产 Docker 部署保持默认行为。

## 2026-09-03：修复本地 MySQL 地址覆盖与部署 Schema 权限失败

- 影响范围：Skyline 本地开发与 `chat-home-server` 发布流水线。
- 本地修复：确认 `cluster-client` 默认使用 7777；仅在本机残留进程导致端口冲突时临时设置 `NODE_CLUSTER_CLIENT_PORT`，不作为常规环境变量。数据库地址、账号、密码和库名统一由 Nacos 提供。
- 部署修复：新增 `dist/cli/apply-schema-bootstrap.js`，使用 Nacos 数据库管理员连接创建仅授权 Skyline 数据库的临时迁移账号，调用原 Schema 迁移逻辑后立即删除，避免 `root` 等全局权限账号触发隔离校验失败。
- 验证：执行格式检查、TypeScript 类型检查、Nest 构建和 67 项单元测试；本地 `yarn dev` 已进入监听与任务加载流程。
- 回滚：恢复上一版完整 SHA 和部署脚本；数据库迁移台账与已执行结构不回滚。

## 2026-09-03：适配嵌套 Feign 配置并改为只读校验 Nacos

- 影响机器：`chat-home-server`。
- 关联版本：Skyline 本次完整 Git SHA 镜像。
- 变更内容：启动时将 Nacos `feign.chat-web-*.url/timeout` 映射为共享客户端兼容键，汇率任务凭据读取 `feign.service_token`；部署前脚本仅校验已有 Data ID，不再回写或补齐人工配置。
- 机器侧操作：确认 Skyline Nacos 已配置 `server.port`、`database.chat-web-skyline`、`feign.service_token` 及 Account/Finance/CRM Feign 节点；`.env` 仅保留 Nacos 启动参数。
- 验证命令：执行 `yarn build`、`yarn tsc -p tsconfig.json --noEmit`；部署后检查 `/health/live`、汇率同步 Feign 调用和 Nacos 注册状态。
- 回滚方法：恢复上一版 Skyline 镜像和脚本；Nacos 配置与汇率数据不回滚。

## 2026-09-03：修复 mysql2 依赖安装完整性校验

- 影响范围：Skyline `chat-home-server` 发布流水线；运行时配置和数据库结构不变。
- 关联版本：Skyline 完整 Git SHA 镜像构建。
- 变更内容：锁定 `mysql2@3.23.3` 使用官方 npm tarball，修正被截断一位的 SHA-1 URL 片段，并保留与上游元数据一致的 SHA-512 完整性校验。
- 机器侧操作：无需修改主机 `.env`、Nacos 或数据库。
- 验证：执行 `yarn format:check && yarn typecheck && yarn build && yarn test:unit`，并重新运行发布流水线依赖安装、容器健康和 Gateway 端点检查。
- 回滚：恢复上一版 Skyline 完整 Git SHA；无需回滚数据库迁移。

## 2026-09-03：增加部署前 Skyline Nacos 配置校准

- 影响范围：Skyline `chat-home-server` 部署流水线和对应 Nacos Data ID；不修改其他服务。
- 变更内容：新增 `deploy/bootstrap-nacos-config.cjs`，在切换容器前读取并校准已有配置，固定 `server.port: 5040`，补齐 Finance/Frankfurter 非敏感默认项，并校验 `database.chat-web-skyline` 与 `security.serviceToken`。
- 安全边界：脚本不创建数据库、数据库账号或服务 Token，不把配置正文、密码和 Token 输出到 Runner 日志；服务间凭据必须预先配置在 Nacos，不接受主机 `.env` 覆盖。
- 失败处理：Data ID 不存在、数据库节点不完整或缺少服务间凭据时在部署前失败，当前容器不会切换；补齐 Nacos 配置后重新运行流水线。
- 验证：执行 `yarn format:check && yarn typecheck && yarn test:full`，并在部署后按本手册执行 Nacos、Schema、容器和 Gateway 健康检查。

## 2026-09-02：新增系统任务与每日汇率同步

- 影响范围：Skyline 服务本身及其 `chat-home-server` 数据库；Finance 通过既有 Feign 同步接口接收汇率。
- 变更内容：新增系统任务管理接口和 `tb_skyline_datetask_system` 实体接入；服务启动时幂等初始化每日汇率任务，支持启停、Cron 调整、手动触发和最近执行日志查询。调度器调用 Frankfurter 获取 USD 基准汇率，再调用 Finance `/currency/exchange/sync` 写入财务汇率表。
- 配置：数据库节点使用 Nacos `database.chat-web-skyline`；自动调度所需内部 Bearer 凭据使用 Nacos `feign.service_token`，真实令牌不得提交。
- 数据库：新增 `dist/cli/apply-schema.js` 增量迁移命令，部署脚本在切换容器前自动执行 `@wlisfes/chat-web-base-schema` 发布包中的 Skyline Schema SQL，并用 `tb_skyline_schema_migration` 保存校验和；TypeORM 保持 `synchronize: false`，服务不会在启动时自动改表。
- 验证：执行 `yarn format:check && yarn typecheck && yarn test:full && yarn build`；部署后验证容器 `/health/live`、Gateway `/api/skyline/deploy/datetask/column` 及手动触发结果。
- 回滚：回滚 Skyline 完整 SHA；数据库增量 SQL 为不可逆结构版本，按 Schema 迁移工具记录处理，不手工删除任务表。

## 2026-08-31：拆分快速单测与完整校验

- 影响范围：Skyline 本地测试命令与 GitHub Actions 验证阶段；部署机器运行参数不变。
- 关联版本：服务版本 `0.0.1`。
- 变更内容：`yarn test` 改为快速单测，新增 `yarn test:unit`；完整单测、E2E 和构建使用 `yarn test:full`，流水线改用完整命令。
- 机器侧操作：无需额外操作。
- 验证命令：`yarn test:unit`、`yarn test:full`。
- 回滚方法：恢复本次变更前的 `package.json` 与 Workflow 文件。

## 2026-08-31：升级共享基础包并统一本地依赖认证

- 影响范围：Skyline 本地开发与后续部署构建。
- 关联版本：`@wlisfes/chat-web-base-schema@1.4.18`。
- 变更内容：Skyline 升级共享基础包，依赖安装继续通过 `scripts/yarn-auth.cjs` 临时读取 GitHub CLI 凭据，避免 GitHub Packages 返回 401；不保存真实 Token。
- 验证命令：`yarn install`、`yarn build`、`yarn test`。
- 回滚方法：恢复上一版 package.json/yarn.lock 与依赖认证脚本。

## 2026-08-29：废弃 Skyline 独立域名并接入统一网关

- 影响机器：`chat-home-server`；服务端口仍为 `5040`。
- 关联版本：Skyline 本次完整 Git SHA 镜像；Gateway Nacos 路由 `/api/skyline/**`。
- 变更内容：删除版本化独立 Nginx 入口，部署时清理 `skyline.lisfes.com` 遗留配置；公开访问统一改为 Gateway `/api/skyline/**`。
- 机器侧操作：流水线删除共享 Nginx 中的 Skyline 专用配置并 reload，随后通过 Gateway 验证健康接口和首页。
- 验证命令：访问 `https://chat.lisfes.com/api/skyline/health/live`，预期返回 `{"status":"UP"}`；确认 Nginx 配置中不存在 `skyline.lisfes.com`。
- 回滚方法：恢复上一版 Skyline 镜像并从 Nacos 删除 `/api/skyline` 路由；如确需恢复旧域名，必须单独恢复 Nginx 配置和 DNS。

## 2026-08-29：部署前清理旧版 Nacos 覆盖项

- 变更内容：部署流水线自动从主机 `.env` 移除 `NACOS_REQUEST_TIMEOUT`、`NACOS_REGISTER_PORT`、`NACOS_REGISTER_IP`、`NACOS_REGISTER_REQUIRED`、`NACOS_GROUP` 和 `NACOS_CONFIG_GROUP`，统一使用共享包默认值。
- 修复原因：历史 `.env` 残留字段会覆盖新的端口和分组默认值，导致 Skyline 注册为旧端口 `4020` 而实际监听 `5040`。
- 影响范围：仅修改 Skyline 部署主机的启动覆盖项，不影响 Nacos 远端业务配置。

## 2026-08-29：部署时自动同步共享 Nginx 路由

- 影响范围：`chat-home-server` 的 Skyline 入口；不修改其他服务容器。
- 变更内容：部署步骤自动查找 `chat-web-nginx` 中包含 `skyline.lisfes.com` 的配置，将 Skyline upstream 更新为容器端口 `5040`；未找到既有配置时安装版本化入口文件，并在校验通过后 reload Nginx。
- 修复原因：Skyline 容器已迁移到 `5040`，旧 Nginx upstream 仍指向 `4020`，导致域名首页返回 `502`。
- 验证：部署后执行 Nginx 配置检查、容器 `/health/live`、域名 `/health/live` 及首页响应校验。
- 回滚：恢复上一版 Skyline 镜像，并将 Nginx Skyline upstream 改回对应端口后执行 `docker exec chat-web-nginx nginx -s reload`。

## 2026-08-29：放宽 Nginx reload 后域名校验时序

- 变更内容：域名健康检查和首页检查各自最多重试 10 次，覆盖 Nginx reload 后 Docker DNS/连接短暂切换窗口。
- 修复原因：容器和 Nginx 配置已正常，但 reload 后立即访问可能短暂返回 `502`，导致部署被误判失败。
- 验证：容器健康接口、域名 `/health/live` 和首页内容均在重试窗口内通过后才判定部署成功。

## 2026-08-29：统一 Nacos 启动参数转换

- 影响范围：本地开发和 `chat-home-server`；本次仅改造调用代码，不触发镜像构建或线上部署。
- 关联版本：等待 `@wlisfes/chat-web-base-schema` 发布包含 `forRootNacosRuntimeOptions` 的新版本。
- 变更内容：Skyline 直接调用 `NacosModule.forRoot(forRootNacosRuntimeOptions(process.env))`，移除逐字段环境变量映射。
- 机器侧操作：共享包发布并升级后再重建 Skyline；现有 Nacos 配置、端口和入口不变。
- 验证命令：共享包发布后执行 `yarn build && yarn test`，再按本服务健康检查验证。
- 回滚方法：恢复上一版共享包并还原旧的 `createNacosRuntimeOptions` 调用。

## 2026-08-29：统一 Skyline 监听端口为 5040

- 影响范围：本地开发和 `chat-home-server`；Company Runner 当前离线，本次不等待其部署结果。
- 关联版本：Skyline 本次 `developer` 配置提交；未合并 `main`，不触发镜像构建或线上部署。
- 变更内容：Skyline 容器、Nacos 注册、健康检查、Nginx upstream 和 `skyline.lisfes.com` 入口由 `4020` 统一为 `5040`；云端生产与 development Data ID 的 `server.port` 已同步为 `5040`。
- 机器侧操作：下次部署重新创建 Skyline 容器并加载新的共享入口配置；域名、Docker 网络和服务数据不变。
- 验证：检查容器内 `PORT=5040`、访问 `https://skyline.lisfes.com/health/live`，并确认 Nacos 注册实例端口为 `5040`。
- 回滚：恢复上一条健康 Skyline 完整 SHA，并将 Nacos、Nginx upstream 与健康检查端口恢复为旧值。

## 2026-08-29：统一环境示例并完善云端 Nacos 注释

- 影响范围：本地开发和 `chat-home-server`；Company Runner 当前离线，本次不等待其部署结果。
- 关联版本：Skyline 本次 `developer` 配置提交；未合并 `main`，不触发镜像构建或线上部署。
- 变更内容：`.env.example` 与其他微服务统一只描述 `NODE_ENV`、`PORT` 和 Nacos 参数；业务配置留在云端 Nacos，并为生产及 development Data ID 补充中文注释。
- 机器侧操作：无需修改端口、域名、Docker 网络或业务数据库；真实 Nacos 密钥继续只保存在部署主机 `.env`。
- 验证：检查两个 Skyline Nacos Data ID 的注释、执行 `yarn build`，并验证 `/health/live` 与服务注册。
- 回滚：恢复上一条健康 Skyline 完整 SHA；Nacos 配置和服务数据不回滚。

## 2026-08-29：Runner 标签统一为 chat-home-server

- 影响范围：仅 `chat-home-server`；原另一台部署机器已废弃并下线，不再恢复双机部署。
- 关联版本：Skyline 本次 `developer` 配置提交；未合并 `main`，不触发镜像构建或线上部署。
- 变更内容：现有单机部署的 Runner 选择标签由 `chat-server-home` 改为 `chat-home-server`，继续使用 `production-home` Environment、`skyline.lisfes.com` 和 `/opt/chat-web-skyline-service` 部署目录。
- 机器侧操作：Skyline 仓库在线 Runner 的自定义标签已由 `chat-server-home` 更新为 `chat-home-server`，systemd 服务保持运行；无需修改 `.env`、Nacos、端口、域名或 Docker 网络。
- 验证：校验 Actions YAML，确认现行配置不再引用 `chat-server-company`、`chat-server-home`、`production-company` 或部署矩阵。
- 回滚：若新标签无法调度，仅把当前单机任务和在线 Runner 的自定义标签临时改回 `chat-server-home`；不得恢复废弃机器的部署任务，服务数据不回滚。

## 2026-08-28：服务名改由环境变量提供

- 影响范围：本地开发和 Home；Company 单机例外和部署拓扑不变，本次只更新 `developer`。
- 关联版本：`@wlisfes/chat-web-base-schema@1.4.14`。
- 变更内容：`createNacosRuntimeOptions` 的 `serviceName` 改为读取 `NACOS_SERVICE_NAME`。
- 机器侧操作：在 `/opt/chat-web-skyline-service/.env` 中增加 `NACOS_SERVICE_NAME=chat-web-skyline-service` 后重新部署。
- 验证：执行项目完整校验，并确认 Nacos 中注册的服务名和 Data ID 正确。
- 回滚：恢复上一完整 Git SHA，并删除机器侧 `NACOS_SERVICE_NAME`。

## 2026-08-28：删除重复的 Nacos 端口入参

- 影响范围：Home；Company 单机例外和部署拓扑不变，本次只更新 `developer`。
- 关联版本：`@wlisfes/chat-web-base-schema@1.4.14`。
- 变更内容：删除 `createNacosRuntimeOptions` 的重复 `PORT` 入参，改由 `registerPort` 直接接收 `process.env.PORT`。
- 机器侧操作：无需新增环境变量，继续保留 `PORT`、`NACOS_SERVER` 和 `NACOS_NAMESPACE`。
- 验证：执行 `yarn format:check && yarn typecheck && yarn test --runInBand && yarn test:e2e --runInBand && yarn build`，并校验 Compose。
- 回滚：恢复上一条健康 Skyline 完整 SHA，并将共享包固定回 `1.4.13`。

## 2026-08-28：升级 Base Schema 并统一端口变量

- 影响范围：Home；Company 单机例外和部署拓扑不变，本次只更新 `developer`。
- 关联版本：`@wlisfes/chat-web-base-schema@1.4.13`，Data ID 仍为 `chat-web-skyline-service.yaml`。
- 变更内容：升级共享包，在 `NacosModule.forRoot()` 调用处显式映射 Nacos 环境；本地 `.env.example` 只保留 `NODE_ENV`、`PORT`、`NACOS_SERVER`、`NACOS_NAMESPACE` 四个字段，服务名继续由代码提供。
- 机器侧操作：Home 现有部署已使用 `PORT=4020`，无需新增变量；确认 `NACOS_SERVER`、`NACOS_NAMESPACE` 正确。
- 验证：执行 `yarn format:check && yarn typecheck && yarn test && yarn test:e2e && yarn build`，并校验 Compose；部署后检查 `/health/live` 和 Nacos 中的 `chat-web-skyline-service:4020` 实例。
- 回滚：恢复上一条健康 Skyline 完整 SHA，并将共享包固定回 `1.4.12`；Nacos 数据不回滚。

## 2026-08-27：补齐 Base Schema 对等依赖

- 影响范围：Home 镜像的依赖层；Company 单机例外、容器、域名、端口、Nacos Data ID 和部署拓扑不变，本次不发布。
- 关联版本：`@wlisfes/chat-web-base-schema@1.4.11`；依赖版本参考 `chat-web-account-service`。
- 变更内容：补齐 `@nestjs/swagger`、`@nestjs/typeorm`、`class-transformer`、`express`、`redis`、`typeorm`，继续使用 GitHub Packages `.npmrc`；Faker、MySQL 驱动和验证码等账号业务依赖不复制。
- 运行边界：TypeORM 与 Redis 只用于满足 Base Schema 对等依赖，当前 Skyline 不创建数据库或 Redis 连接。
- 机器侧操作：无；CI 继续使用 `NODE_AUTH_TOKEN`，Docker 继续通过 BuildKit `github_token` Secret 拉取私有包。
- 验证：冻结锁文件安装、全部对等依赖版本校验、Base Schema 全导出入口加载、格式检查、类型检查、Jest、E2E 和 Nest 构建。
- 回滚：回滚本提交；无数据库、Redis 或其他有状态数据变更。

## 2026-08-27：接入共享 Nacos 模块

- 影响范围：Home；Company 单机例外和现有部署拓扑不变，本次仅在 `developer` 开发。
- 关联版本：`@wlisfes/chat-web-base-schema@1.4.10`，Data ID `chat-web-skyline-service.yaml`。
- 变更内容：通过共享 `NacosModule.forRoot` 加载远端配置并注册 `chat-web-skyline-service`，不引入数据库、Redis 或业务模块。
- 机器侧操作：确认 `/opt/chat-web-skyline-service/.env` 包含 Home 的 `NACOS_SERVER` 和 `NACOS_NAMESPACE`。
- 验证：执行 `yarn format:check && yarn typecheck && yarn test && yarn test:e2e && yarn build`。
- 回滚：回滚本提交并删除机器 `.env` 中新增的 Nacos 连接项；Nacos Data ID 不回滚。

## 2026-08-27：还原为 NestJS 初始化空项目

- 影响范围：Home；保留现有容器、域名、Runner、Docker 网络与自动回滚，不执行线上部署。
- 工程重置：删除 Vue、SSR、Webpack、前端资源、模拟业务数据及其测试，恢复 NestJS 默认 `AppController`、`AppService`、`AppModule` 和启动入口。
- 依赖清理：删除 Nacos、`chat-web-base-schema`、Naive UI、Pinia、Vue 与旧 SSR 构建依赖；当前服务不连接任何下游。
- 部署适配：容器和流水线改为检查 `/health/live`，首页标志改为 `Hello World!`，删除 Nacos 配置引导和 favicon 验证。
- 机器侧操作：无；本次只在 `developer` 开发，不合并 `main`、不触发流水线。以后发布时，现有 `.env` 中多余的 Nacos 字段可保留但不会读取。
- 验证：执行格式检查、TypeScript 类型检查、Jest 单元/E2E 测试、Nest 构建及本地生产进程 HTTP 验证。
- 回滚：回滚到重置前的完整 SHA；本次无数据库、Redis 或其他有状态数据变更。

## 2026-08-26：新增 Skyline 站点图标

- 影响范围：Home；不修改 Company、Nacos、数据库、Redis 或共享 Nginx 配置。
- 变更内容：从 `nest-platform-manager` 复制 `favicon.ico`，在 SSR 文档头显式引用 `/favicon.ico`，并将 `public` 目录纳入生产镜像。
- 机器侧操作：无手工操作；`main` 流水线构建新镜像并更新 Home 容器。
- 验证：流水线请求 `https://skyline.lisfes.com/favicon.ico`；容器内校验 `/app/public/favicon.ico` 存在。
- 回滚：回滚到上一完整 SHA 镜像；本次无有状态数据变更。

## 2026-08-26：路径别名与生产运行时修复

- 影响范围：Home；不修改 Company、数据库、Redis、Nacos Data ID 或共享 Nginx 配置。
- 路径别名：统一 `@/*` 指向 `src/*`、`@web/*` 指向 `web/*`，并兼容 SSR 6 自动生成入口中固定的 Web 别名。
- 故障与回滚：首次部署的新镜像在生产依赖层启动时因顶层加载构建期 `webpack` 失败，流水线自动恢复上一健康镜像，线上服务未中断。
- 修复：Webpack 插件改为仅在构建钩子中延迟加载；使用生产依赖层验证容器健康、readiness 与 SSR 首页后重新发布。
- 回滚：回滚到上一完整 SHA 镜像；本次无有状态数据变更。

## 2026-08-26：清理重复配置并加强部署后 SSR 验证

- 影响范围：Home；不修改 Company、数据库、Redis、Nacos Data ID 或共享 Nginx 配置。
- 配置清理：删除被 Docker 部署提交错误恢复的 `src/config` 及孤立 Nacos 开关测试，Skyline 统一使用 `chat-web-base-schema` 的共享 `NacosModule`。
- 自动化：Home 部署后除 `/health/ready` 外，再访问 `https://skyline.lisfes.com/` 并校验 SSR 标志文本，避免只验证健康接口而遗漏首页渲染异常。
- 回滚：回滚到上一完整 SHA 镜像；本次无有状态数据变更。

## 2026-08-26：Home Docker 自动构建部署与独立域名

- 影响范围：Home；Company 当前离线，按用户明确批准的单机例外不创建 Company 部署任务。
- 关联版本：首次 Docker 自动部署提交；镜像由流水线使用合并后 `main` 的完整 `GITHUB_SHA` 标记。
- 容器与网络：新增 `chat-web-skyline-service`，容器端口 `4020`，不发布宿主机端口；Compose 项目 `chat-web-service`，接入外部 `chat-web-infrastructure`。
- 域名与 TLS：`https://skyline.lisfes.com` 由共享 `chat-web-nginx` 终止 TLS，并通过 Docker DNS 动态代理到 Skyline；继续使用 Home 已存在且包含该 SAN 的本地证书。
- 自动化：新增 main push / workflow dispatch 流水线，GitHub Hosted Runner 完整验证并只构建一次 SHA 镜像，`chat-server-home` 专用 Runner 部署；新容器失败时恢复旧镜像。
- Nacos：Data ID `chat-web-skyline-service.yaml` 净化为只含 `server.port: 4020`；删除旧配置误带的数据库节点，Skyline 仍不连接 MySQL 或 Redis。
- 日志：Compose 使用 `json-file`，单文件最大 `20m`、保留 `30` 个文件；Dozzle 从 Docker Socket 读取标准输出。
- 机器侧操作：创建 `/opt/chat-web-skyline-service/.env` 和专用 Runner；把版本化 `shared-ingress.conf` 同步到 Home Nginx 配置卷，`nginx -t` 通过后 reload。真实 Namespace、Token 和完整 `.env` 不写入仓库或日志。

### 验证

```bash
yarn test
docker inspect chat-web-skyline-service --format '{{.Config.Image}} {{.State.Health.Status}} {{.RestartCount}}'
docker exec chat-web-skyline-service node -e "require('http').get('http://127.0.0.1:4020/health/ready', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
curl -kfsS --resolve skyline.lisfes.com:443:127.0.0.1 https://skyline.lisfes.com/health/ready
docker logs --tail 100 chat-web-skyline-service
```

### 回滚

- 自动部署失败时由 `deploy.sh` 恢复上一完整 SHA 镜像。
- 手工回滚只对 `skyline-service` 执行 `docker compose up -d --no-deps`，不得使用 `--remove-orphans`。
- Nacos 和共享 Nginx 配置保持不变；本次没有数据库、Redis 或其他有状态数据需要回滚。
