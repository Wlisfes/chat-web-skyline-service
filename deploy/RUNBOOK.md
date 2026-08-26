# Skyline 服务部署与故障恢复手册

## 当前基线

| 项目 | 值 |
| --- | --- |
| 访问地址 | `https://skyline.lisfes.com` |
| 容器 | `chat-web-skyline-service` |
| Compose 项目 / 服务 | `chat-web-service` / `skyline-service` |
| 容器端口 | `4020`，不发布宿主机端口 |
| 部署目录 | `/opt/chat-web-skyline-service` |
| Docker 网络 | `chat-web-infrastructure` |
| Nacos Data ID / Group | `chat-web-skyline-service.yaml` / `DEFAULT_GROUP` |
| Nacos 服务名 | `chat-web-skyline-service` |
| Home Runner 标签 | `chat-server-home` |
| GitHub Environment | `production-home` |
| 共享入口 | `chat-web-nginx` |
| Home Nginx 配置卷 | `20260801231547_nginx-conf` |

当前按用户明确批准的单机例外只部署 Home。Company 机器离线期间，流水线不创建会长期等待的 Company job；后续恢复 Company 时必须使用同一个完整 Git SHA 镜像，并补回独立 Runner、Environment 和 `deploy-company` concurrency。

## 首次 Home 初始化

### 1. Runner 与部署目录

仓库必须使用独立 Runner，不能复用 Account、Finance、CRM、Gateway 或 Manager 的 Runner 目录。当前约定：

- 安装目录：`/home/runner/actions-runner-skyline`
- systemd 单元：`actions.runner.Wlisfes-chat-web-skyline-service.chat-server-home-skyline.service`
- 标签：`self-hosted`、`linux`、`chat-server-home`

Runner 用户需要能访问 Docker，并能写入部署目录：

```bash
sudo install -d -o runner -g runner -m 0750 /opt/chat-web-skyline-service
docker network inspect chat-web-infrastructure
```

### 2. 机器侧环境变量

从 `deploy/.env.example` 创建 `/opt/chat-web-skyline-service/.env`，权限固定为 `0600`。必须把 `NACOS_NAMESPACE` 改成 Home 的真实 Namespace ID；Nacos 地址使用同一 Docker 网络中的 `chat-web-nacos:8848`。真实 `.env`、用户名和密码不得复制到 Git、Actions 日志或文档。

```bash
install -m 0600 deploy/.env.example /opt/chat-web-skyline-service/.env
chmod 0600 /opt/chat-web-skyline-service/.env
```

部署流水线运行 `bootstrap-nacos-config.cjs`，将 Data ID 净化为：

```yaml
server:
    port: 4020
```

Skyline 不使用数据库或 Redis；Data ID 中不得保留 `database`、`redis` 或其他服务的连接信息。

### 3. 共享 Nginx 域名

Windows hosts 必须包含：

```text
127.0.0.1 skyline.lisfes.com
```

当前 `lisfes.pem` 证书必须包含 `DNS:skyline.lisfes.com`。把 `deploy/shared-ingress.conf` 安装为共享 Nginx 卷中的 `skyline.conf`，先检查再 reload：

```bash
docker create --name skyline-ingress-edit -v 20260801231547_nginx-conf:/conf alpine:3.22
docker cp deploy/shared-ingress.conf skyline-ingress-edit:/conf/skyline.conf
docker rm skyline-ingress-edit
docker exec chat-web-nginx nginx -t
docker exec chat-web-nginx nginx -s reload
```

入口在请求阶段动态解析 `chat-web-skyline-service:4020`。Skyline 未运行时只返回 502，不会导致 Nginx 启动失败或循环重启。

## 发布与验证

`main` push 自动执行 verify、build 和 Home deploy。镜像必须使用完整 Git SHA 标签，Home job 只引用 build job 输出的同一镜像。

```bash
docker inspect chat-web-skyline-service --format '{{.Config.Image}} {{.State.Status}} {{.State.Health.Status}} {{.RestartCount}}'
docker inspect chat-web-skyline-service --format '{{.Config.User}} {{json .HostConfig.LogConfig}}'
docker exec chat-web-skyline-service node -e "require('http').get('http://127.0.0.1:4020/health/ready', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
curl -kfsS --resolve skyline.lisfes.com:443:127.0.0.1 https://skyline.lisfes.com/health/ready
curl -kfsS --resolve skyline.lisfes.com:443:127.0.0.1 https://skyline.lisfes.com/ | grep -F '服务端渲染基础框架已就绪'
docker logs --tail 100 chat-web-skyline-service
```

预期容器为 `running healthy`、用户为 `node`、日志驱动为 `json-file` 且 `max-size=20m`、`max-file=30`，ready 返回 `status=UP`，首页包含 SSR 内容。Dozzle 中该容器归在 `chat-web-service` 分组。

## 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| verify 阶段找不到私有包 | GitHub Packages Token 或仓库 packages 权限异常 | 检查 workflow permissions 与包授权，不要把 Token 写进 `.npmrc` |
| Home job 一直等待 | Skyline 专用 Runner 离线或标签不匹配 | 检查 systemd 单元和 `chat-server-home` 标签 |
| 容器启动后不健康 | Nacos Namespace/Data ID 错误或 SSR 构建产物缺失 | 查看容器日志和 `/health/ready`，修正机器 `.env` 后重新部署 |
| 域名返回 502 | Skyline 未加入共享网络或入口仍指向旧 Kubernetes NodePort | 检查容器网络和卷内 `skyline.conf`，执行 `nginx -t` 后 reload |
| Nginx 循环重启 | 入口误用了静态 upstream DNS | 恢复版本化 `shared-ingress.conf` 的 resolver + 变量代理形式 |
| 本地开发 4020 冲突 | 存在重复的 `yarn dev` | 查询 `Get-NetTCPConnection -LocalPort 4020,8999`；Docker 容器本身不发布这两个端口 |

## 日志轮转

```bash
docker inspect chat-web-skyline-service --format '{{json .HostConfig.LogConfig}}'
docker inspect chat-web-skyline-service --format '{{.LogPath}}'
docker logs --since 10m chat-web-skyline-service
```

Compose 固定 `json-file`、`max-size=20m`、`max-file=30`。不得为排障删除整个 Docker 数据目录或其他服务日志。

## 回滚

`deploy.sh` 在新容器启动失败、健康超时或镜像不匹配时自动恢复替换前镜像。手工回滚：

```bash
cd /opt/chat-web-skyline-service
IMAGE='ghcr.io/wlisfes/chat-web-skyline-service:<previous-full-sha>' docker compose -f compose.yml up -d --no-deps skyline-service
docker inspect chat-web-skyline-service --format '{{.Config.Image}} {{.State.Health.Status}}'
```

回滚不修改 Nacos、共享 Nginx、证书或其他容器，禁止使用 `--remove-orphans`。
