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

未设置 `PORT` 时默认监听 `4020`：

- `GET /` 返回 `Hello World!`
- `GET /health/live` 返回进程存活状态

服务通过 `@wlisfes/chat-web-base-schema` 的 `NacosModule` 读取 `chat-web-skyline-service.yaml` 并注册实例。

## 共享基础包

项目安装 `@wlisfes/chat-web-base-schema@1.4.14`，并按照该包的 `peerDependencies` 与 `chat-web-account-service` 的版本补齐：

- `@nestjs/swagger`、`@nestjs/typeorm`
- `class-transformer`、`express`
- `redis`、`typeorm`

这些依赖用于保证 Base Schema 的全部导出入口可以正常解析；当前空项目仍未连接数据库或 Redis。`@wlisfes` 私有包通过仓库 `.npmrc` 指向 GitHub Packages，`yarn run install` 和 `yarn run schema:update` 会依次复用 `NODE_AUTH_TOKEN`、`gh auth token` 或用户级 `~/.npmrc` 中的 GitHub Packages Token。CI 和 Docker 构建继续使用 `NODE_AUTH_TOKEN`/BuildKit Secret，不在仓库保存 Token。

## 验证

```bash
yarn format:check
yarn typecheck
yarn test
yarn test:e2e
yarn build
```

## 部署

仓库保留现有 Home Docker 自动部署骨架。只有合并到 `main` 后才触发构建部署；日常开发继续使用 `developer`，普通开发完成后不立即合并发布。

部署细节与排障命令见 `deploy/RUNBOOK.md`。
