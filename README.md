# chat-web-skyline-service

NestJS 11 + Vue3 + Naive UI 的单进程服务端渲染基础服务。当前版本使用可从 npm 独立安装的 `ssr` 6.2 稳定版本线与 Webpack 4；待 v7 的 Vue3 插件和类型包完整发布后再单独评估升级。

## 环境

- Node.js 20 或更高版本
- Yarn 1.22.x
- 能读取 `@wlisfes` GitHub Packages 的本机 npm 凭据；仓库 `.npmrc` 只记录 registry，不记录 Token

## 安装与运行

```bash
yarn install --frozen-lockfile
yarn dev
```

默认端口为 `4020`。运行时必须连接 Nacos，并读取 `chat-web-skyline-service.yaml`。根目录 `.env` 只保留 `NODE_ENV`、`PORT`、`NACOS_SERVER`、`NACOS_NAMESPACE` 和 `NACOS_SERVICE_NAME`；如环境启用 Nacos 鉴权，再按共享模块约定提供机器侧凭据。

生产构建与启动：

```bash
yarn build
yarn start:prod
```

`yarn build` 会额外验证 `dist/main.js`、SSR server bundle、client manifest 和 async chunk map，避免 `ssr` CLI 内部失败但退出码仍为 0。

## 验证

```bash
yarn typecheck
yarn test:unit
yarn test:integration
yarn playwright install chromium
yarn test:e2e
yarn test
```

- `GET /health/live` 只验证进程可响应。
- `GET /health/ready` 验证 SSR 运行时已启动，生产环境还验证关键构建产物存在。
- `GET /` 正常返回 `X-Render-Mode: ssr`；SSR 失败时只尝试一次 CSR，并返回 `X-Render-Mode: csr`。

## Nacos 配置

共享包 `1.4.9` 起，Skyline 只向 `NacosModule.forRoot` 传入服务名和注册端口，base 内部统一补齐请求超时、Data ID、配置组、注册开关、服务名、发现组、IP 和注册端口。业务配置统一维护在 Nacos 远端 `chat-web-skyline-service.yaml`：

```yaml
server:
    port: 4020
```

Skyline 直接使用共享 `NacosModule` 加载配置，不再维护独立的 Nacos 开关或 `src/config` 配置目录。本地端到端测试同样需要可访问的 Nacos。

## 数据与身份边界

首版不连接 MySQL 或 Redis，不创建数据库，不分配 Redis index，不导入其他服务 Entity，也不执行跨库 SQL。

Skyline 不保存 Account JWT 密钥，不读取 Account Redis 会话。受保护页面接入时，应从 `@wlisfes/chat-web-base-schema/feign` 使用 `AccountFeignClient`（或共享 `AccountRemoteAuthModule`），将 Bearer Token 转发到 Account 并只接收 `AuthPrincipal`。其他业务数据同样通过强类型 Feign Provider 获取。

## Docker 自动部署

`main` 分支更新后，GitHub Actions 会先执行完整 `yarn test`，再构建并发布完整 Git SHA 镜像，由 Home 主机的 `chat-server-home` 专用 Runner 部署。Company 当前离线，按用户明确批准的单机例外不创建 Company 部署任务。

运行容器为 `chat-web-skyline-service`，Compose 项目为 `chat-web-service`。容器不发布宿主机端口，只通过外部 `chat-web-infrastructure` 网络暴露 `4020`；共享 `chat-web-nginx` 把 `https://skyline.lisfes.com` 动态转发到该容器，因此不会与本地 `yarn dev` 使用的 `4020` 冲突。

首次机器初始化、Nacos 配置、Runner、日志验证和回滚命令见 `deploy/RUNBOOK.md`。真实 Namespace、凭据和 `.env` 只保存在 Home 的 `/opt/chat-web-skyline-service`，不得提交。
