# Skyline Docker 自动部署设计

## 目标

`chat-web-skyline-service` 在 `main` 分支更新后自动完成校验、构建完整 Git SHA 镜像、发布到 GHCR，并由 Home 主机专用 Self-hosted Runner 部署到 Docker。用户通过 `https://skyline.lisfes.com` 访问服务。

本次不引入 MySQL、Redis、Kubernetes 或新的 TLS 终止容器。Company 主机目前离线，按用户已经明确给出的单机例外，本次流水线只部署 Home，不创建会长期等待的 Company 任务。

## 方案比较

### 方案一：共享 Docker 网络直连（采用）

Skyline 容器仅在 `chat-web-infrastructure` 网络暴露 `4020`，共享 `chat-web-nginx` 通过 Docker DNS 动态解析 `chat-web-skyline-service:4020`。该方案不会占用宿主机 `4020`，因此能与本地 `yarn dev` 同时存在；TLS、域名和日志入口也继续复用当前基础设施。

### 方案二：发布宿主机端口

容器把 `4020` 映射到宿主机，再由 Nginx 请求 `host.docker.internal:4020`。实现简单，但会与当前本地开发进程争用端口，并让容器间流量绕过现有 Docker 网络，因此不采用。

### 方案三：Skyline 自带 HTTPS 入口

镜像内增加 Nginx 和证书挂载。该方案会重复维护 TLS、端口和代理配置，也不符合共享网关/入口边界，因此不采用。

## 构建与镜像

镜像采用 Node.js 22 Alpine 多阶段构建：依赖阶段使用 BuildKit Secret 读取 GitHub Packages Token；构建阶段执行 `yarn build`，同时产出 NestJS `dist/`、SSR `build/server/` 和浏览器 `build/client/`；运行阶段只保留生产依赖和构建产物，并使用非 root 的 `node` 用户启动 `node dist/main.js`。

镜像内健康检查请求 `http://127.0.0.1:4020/health/ready`。该端点只有在 NestJS 和生产 SSR 产物都就绪时才返回 200。

## 运行与配置

Compose 项目固定为 `chat-web-service`，服务名为 `skyline-service`，容器名为 `chat-web-skyline-service`。容器使用 `json-file` 日志驱动，单文件最大 20 MB、保留 30 个文件，加入外部网络 `chat-web-infrastructure`，不发布宿主机端口。

机器侧 `/opt/chat-web-skyline-service/.env` 仅保留 Nacos 启动参数、部署环境和 Docker 网络。Nacos Data ID 为 `chat-web-skyline-service.yaml`，配置内容只允许保留：

```yaml
server:
    port: 4020
```

部署前的 Nacos 引导脚本会创建缺失配置，并删除 Skyline 旧配置中误加入的数据库等根节点，保证其无数据库边界不被破坏。

## 自动化流水线

`main` push 和手工 dispatch 触发流水线：

1. GitHub Hosted Runner 使用 Node.js 22 安装冻结依赖并执行完整 `yarn test`。
2. Buildx 只构建一次镜像，同时推送 `${GITHUB_SHA}` 和 `latest` 标签；部署只引用完整 SHA。
3. `chat-server-home` Runner 将 Compose、部署器、Nacos 引导脚本和环境示例安装到 `/opt/chat-web-skyline-service`。
4. Runner 校验 Docker 网络和机器侧 `.env`，修正 Nacos 配置，拉取 SHA 镜像并滚动替换容器。
5. 容器健康后，同时验证容器内 `/health/ready` 和 `https://skyline.lisfes.com/health/ready`。

部署使用 `deploy-home` concurrency，新的 main 版本会取消旧部署。脚本捕获中断；新容器启动失败、健康超时或域名验证失败时恢复部署前镜像。部署命令只更新 `skyline-service`，禁止使用 `--remove-orphans`。

## 域名入口

Home 的共享 Nginx 使用 `deploy/shared-ingress.conf`。配置在请求阶段通过 `127.0.0.11` 解析 `chat-web-skyline-service`，避免 Skyline 停止时让 Nginx 本身启动失败。HTTP 跳转 HTTPS；HTTPS 复用当前包含 `skyline.lisfes.com` SAN 的本地证书，并转发真实来源、协议和升级头。

## 验证与完成标准

- 部署契约单元测试证明 Docker、Compose、Actions、Nacos 和入口配置符合约定。
- `yarn test`、`docker build` 和 Compose 渲染全部通过。
- 本地镜像以非 root 用户运行，容器进入 `healthy`，SSR 首页和客户端资源可访问。
- Home Runner 在线，main 流水线构建和 Home 部署成功。
- `https://skyline.lisfes.com` 返回 SSR 页面，`/health/ready` 返回 200。
- Dozzle 能在 `chat-web-service` 分组看到 Skyline 的结构化日志。

## 回滚

部署脚本记录替换前镜像；失败时用同一 Compose 文件恢复该镜像。Nacos、共享 Nginx 和证书不随镜像回滚。手工回滚只需要指定上一条完整 SHA 镜像执行 `docker compose up -d --no-deps skyline-service`，不得删除其他容器或共享网络。
