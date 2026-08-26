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

默认端口为 `4020`。正常运行默认连接 Nacos，并读取 `chat-web-skyline-service.yaml`。启动时必须显式提供 `NACOS_SERVER` 和 `NACOS_NAMESPACE`；其余启动、订阅和注册覆盖项及默认值见 `.env.example`。显式离线运行：

```bash
NACOS_CONFIG_ENABLED=false NACOS_REGISTER_ENABLED=false yarn dev
```

PowerShell：

```powershell
$env:NACOS_CONFIG_ENABLED='false'
$env:NACOS_REGISTER_ENABLED='false'
yarn dev
```

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

共享包 `1.4.8` 起，Skyline 使用 base 导出的 `createNacosRuntimeOptions` 把完整扁平化 Nacos 运行参数一次性注入 `NacosModule.forRoot`。`NACOS_SERVER` 和 `NACOS_NAMESPACE` 是仅有的无默认值启动参数；请求超时、Data ID、配置组、认证、注册开关、服务名、发现组、IP 和端口都是可选覆盖，完整说明见 `.env.example`。业务配置 Data ID 默认为 `chat-web-skyline-service.yaml`，可包含：

```yaml
server:
    port: 4020
```

生产默认不得关闭 Nacos。`NACOS_CONFIG_ENABLED=false` 只用于测试或明确的离线运行；该开关由 Skyline 在 Nest 模块组合前处理，因为共享 `NacosModule` 初始化后会立即加载配置。

## 数据与身份边界

首版不连接 MySQL 或 Redis，不创建数据库，不分配 Redis index，不导入其他服务 Entity，也不执行跨库 SQL。

Skyline 不保存 Account JWT 密钥，不读取 Account Redis 会话。受保护页面接入时，应从 `@wlisfes/chat-web-base-schema/feign` 使用 `AccountFeignClient`（或共享 `AccountRemoteAuthModule`），将 Bearer Token 转发到 Account 并只接收 `AuthPrincipal`。其他业务数据同样通过强类型 Feign Provider 获取。

## 部署边界

当前仓库没有 Docker、Compose、GitHub Actions、Runner 或 `deploy/` 文件。首次接入自动部署时必须遵守 `AGENTS.md`：同一完整 Git SHA 镜像同时部署 Company 与 Home、独立 Runner 和部署目录、外部 `chat-web-infrastructure` 网络、双机健康验证与失败回滚，并在同一次改动中补全 `deploy/CHANGELOG.md` 和 `deploy/RUNBOOK.md`。
