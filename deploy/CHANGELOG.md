# Skyline 部署变更记录

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
