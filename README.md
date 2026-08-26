# Chat Web Skyline Service

基于 NestJS 11 初始化的空项目，用于后续重新开发 Skyline 服务。

## 环境

- Node.js 22
- Yarn 1.22.22

## 本地运行

```bash
yarn install
yarn dev
```

未设置 `PORT` 时默认监听 `3000`：

- `GET /` 返回 `Hello World!`
- `GET /health/live` 返回进程存活状态

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
