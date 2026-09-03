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

Skyline 的业务数据库配置位于 Nacos `database.chat-web-skyline`，对应表为 `tb_skyline_datetask_system`。`deploy.sh` 会使用待发布镜像执行 `dist/cli/apply-schema-bootstrap.js`：先使用 Nacos 中的管理员连接创建仅授权 Skyline 数据库的临时账号，再以该账号调用 `dist/cli/apply-schema.js`，迁移结束后立即回收临时账号。增量 SQL 按文件名顺序应用，并在 `tb_skyline_schema_migration` 中保存文件校验和；迁移失败时不会切换当前容器。TypeORM 保持 `synchronize: false`，不会在服务启动时自行改表。系统任务初始化失败会在容器日志中记录并触发健康检查失败。

流水线会先把 `deploy/bootstrap-nacos-config.cjs` 安装到 `/opt/chat-web-skyline-service`，再使用 `node:22-alpine`（加入 `chat-web-infrastructure` 网络）执行只读校验。脚本不会回写 Nacos，不会补齐或覆盖任何业务配置；它校验 `server.port: 5040`、`database.chat-web-skyline` 以及 `feign.service_token` 和 Account/Finance/CRM 的 `url`、`timeout`。脚本不会把 Nacos 配置正文或凭据写入 Runner 日志；缺少节点/凭据时应先人工配置后重跑流水线。

每日汇率任务通过 Feign 调用 Finance `/currency/exchange/sync`。自动调度没有用户请求上下文，必须在 Nacos `feign.service_token` 配置内部 Bearer 凭据；手动触发会转发当前请求的 Bearer 令牌。令牌不得写入仓库或日志。

## 验证

```bash
docker inspect chat-web-skyline-service --format '{{.Config.Image}} {{.State.Health.Status}} {{.RestartCount}}'
docker exec chat-web-skyline-service node -e "require('http').get('http://127.0.0.1:5040/health/live', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
docker exec chat-web-gateway-service node -e "fetch('http://127.0.0.1:5000/api/skyline/health/live').then(response => response.text()).then(console.log)"
curl -kfsS --resolve chat.lisfes.com:443:127.0.0.1 https://chat.lisfes.com/api/skyline/health/live
docker logs --tail 100 chat-web-skyline-service

# 手动执行/核对 Skyline Schema（需要当前目录存在 .env）
docker run --rm --network chat-web-infrastructure --env-file /opt/chat-web-skyline-service/.env \
  --entrypoint node "$IMAGE" dist/cli/apply-schema-bootstrap.js

# 手动核对/校准 Nacos 配置（不会创建数据库或凭据）
docker run --rm --network chat-web-infrastructure \
  --env-file /opt/chat-web-skyline-service/.env \
  -v /opt/chat-web-skyline-service/bootstrap-nacos-config.cjs:/app/bootstrap-nacos-config.cjs:ro \
  -w /app node:22-alpine node bootstrap-nacos-config.cjs

# 查看系统任务接口（需要 Bearer 令牌）
curl -fsS -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  --data '{"page":1,"size":50}' \
  http://127.0.0.1:5040/deploy/datetask/column
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
