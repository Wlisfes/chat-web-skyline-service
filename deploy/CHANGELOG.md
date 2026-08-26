# Skyline 部署变更记录

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
