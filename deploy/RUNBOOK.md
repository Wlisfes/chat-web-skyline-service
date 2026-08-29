# Skyline 部署与排障手册

## 当前形态

Skyline 只在 `chat-home-server` 使用 Docker 自动部署，Runner 标签为 `chat-home-server`，GitHub Environment 为 `production-home`。原另一台部署机器已废弃并下线，不再创建部署任务。

## 容器基线

- Compose 项目：`chat-web-service`
- Compose 服务：`skyline-service`
- 容器：`chat-web-skyline-service`
- 容器端口：`5040`，不发布宿主机端口
- 外部网络：`chat-web-infrastructure`
- 健康接口：`GET /health/live`
- 公开入口：Gateway `/api/skyline/**`
- 日志：`json-file`，单文件最大 `20m`，保留 `30` 个文件

## 配置

机器配置位于 `/opt/chat-web-skyline-service/.env`。服务统一读取 `PORT`，容器内固定为 `5040`；此外还必须提供 `NACOS_SERVER`、`NACOS_SERVICE_NAME` 和 `NACOS_NAMESPACE`。默认 Data ID 为 `${NACOS_SERVICE_NAME}.yaml`，服务注册名为 `NACOS_SERVICE_NAME` 的值；真实机器配置不得提交到仓库。

## 验证

```bash
docker inspect chat-web-skyline-service --format '{{.Config.Image}} {{.State.Health.Status}} {{.RestartCount}}'
docker exec chat-web-skyline-service node -e "require('http').get('http://127.0.0.1:5040/health/live', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
docker exec chat-web-gateway-service node -e "fetch('http://127.0.0.1:5000/api/skyline/health/live').then(response => response.text()).then(console.log)"
curl -kfsS --resolve chat.lisfes.com:443:127.0.0.1 https://chat.lisfes.com/api/skyline/health/live
docker logs --tail 100 chat-web-skyline-service
```

预期容器为 `running healthy`，运行用户为 `node`，Gateway 健康接口返回 `{"status":"UP"}`。`skyline.lisfes.com` 已废弃，共享 Nginx 中不得保留对应 Server 配置。

## 日志轮转验证

```bash
docker inspect chat-web-skyline-service --format '{{json .HostConfig.LogConfig}}'
docker inspect chat-web-skyline-service --format '{{.LogPath}}'
```

Dozzle 中容器应归类在 `chat-web-service` 分组。

## 回滚

- 自动部署失败时，`deploy.sh` 恢复上一完整 SHA 镜像。
- 手工回滚只对 `skyline-service` 执行 `docker compose up -d --no-deps`。
- 禁止使用 `--remove-orphans`，避免删除同一 Compose 项目的其他服务。
