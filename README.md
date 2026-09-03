# Chat Web Skyline Service

基于 NestJS 11 初始化的空项目，用于后续重新开发 Skyline 服务。

## 环境

- Node.js 22
- Yarn 1.22.22

## 本地运行

复制 `.env.example` 为 `.env`，填写 Nacos Namespace ID：

```bash
cp .env.example .env
yarn install
yarn dev
```

未设置 `PORT` 时默认监听 `5040`：

- `GET /` 返回 `Hello World!`
- `GET /health/live` 返回进程存活状态

对外访问统一经过 Gateway：

- `GET /api/skyline/` 返回 `Hello World!`
- `GET /api/skyline/health/live` 返回进程存活状态

`skyline.lisfes.com` 独立域名已经废弃，不再由共享 Nginx 直接代理 Skyline。

服务通过 `@wlisfes/chat-web-base-schema` 的 `NacosModule` 读取 `chat-web-skyline-service.yaml` 并注册实例。

## 共享基础包

项目安装 `@wlisfes/chat-web-base-schema`，并按照该包的 `peerDependencies` 与 `chat-web-account-service` 的版本补齐：

- `@nestjs/swagger`、`@nestjs/typeorm`
- `class-transformer`、`express`
- `redis`、`typeorm`

这些依赖用于保证 Base Schema 的全部导出入口可以正常解析。Skyline 业务数据库由 Nacos 的 `database.chat-web-skyline` 节点提供，镜像内置 `yarn schema:apply` 增量迁移命令，部署脚本会在启动新容器前通过 `dist/cli/apply-schema-bootstrap.js` 临时创建仅限 Skyline 数据库的迁移账号，完成后立即回收，再应用共享 Schema SQL，并通过 `tb_skyline_schema_migration` 保存文件校验和；TypeORM 保持 `synchronize: false`，服务启动时不会自动改表。`@wlisfes` 私有包通过仓库 `.npmrc` 指向 GitHub Packages，`yarn run install` 和 `yarn run schema:update` 会依次复用 `NODE_AUTH_TOKEN`、`gh auth token` 或用户级 `~/.npmrc` 中的 GitHub Packages Token。CI 和 Docker 构建继续使用 `NODE_AUTH_TOKEN`/BuildKit Secret，不在仓库保存 Token。

## 系统任务

系统任务管理页面对应 `POST /api/skyline/deploy/datetask/column`（以及同目录下的 `status/update`、`cron/update`、`trigger`、`log/column` 接口）。任务定义由服务启动时幂等初始化，页面不提供新增和删除操作。首个内置任务每天从 [Frankfurter](https://api.frankfurter.dev) 获取 USD 基准汇率，再通过共享 Feign 客户端调用 Finance 的 `/currency/exchange/sync` 写入汇率表。

定时执行需要一个可被 Finance 服务接受的内部 Bearer 凭据，该凭据统一从 Nacos `feign.service_token` 读取；手动触发时会沿用当前请求的 `Authorization`。

## 验证

```bash
yarn format:check
yarn typecheck
yarn test
yarn test:e2e
yarn build
```

## 部署

仓库保留 `chat-home-server` Docker 自动部署。只有合并到 `main` 后才触发构建部署；日常开发继续使用 `developer`，普通开发完成后不立即合并发布。部署完成后通过 Gateway `/api/skyline/**` 验证服务。原另一台部署机器已废弃，不再创建部署任务。

流水线在切换 Skyline 容器前会通过 `node:22-alpine` 执行 `deploy/bootstrap-nacos-config.cjs`，仅读取并校验已有的 Skyline Nacos Data ID，不会回写人工配置。脚本校验 `server.port: 5040`、`database.chat-web-skyline` 以及 `feign.service_token` 和 Account/Finance/CRM 的地址与超时；不会修改 Nacos 或输出配置正文。随后 `deploy.sh` 使用待发布镜像的 `apply-schema-bootstrap.js` 临时创建仅限 Skyline 数据库的迁移账号，执行完成后立即删除，避免直接使用拥有全局权限的管理员账号执行业务 DDL。缺少配置或数据库管理员不具备创建临时账号的权限时部署会停止，需先在 Nacos 补齐配置。

部署细节与排障命令见 `deploy/RUNBOOK.md`。
