# Skyline Docker 自动部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Skyline 在 `main` 更新后构建完整 SHA Docker 镜像，经 Home Runner 自动部署，并由 `https://skyline.lisfes.com` 提供服务。

**Architecture:** 使用 Node.js 22 多阶段镜像承载 NestJS + Vue SSR 单进程；Compose 只把容器加入共享网络，不发布宿主机端口；共享 Nginx 通过动态 Docker DNS 转发。GitHub Actions 先完整验证，再构建一次镜像并在 Home 执行带健康检查和回滚的部署器。

**Tech Stack:** Node.js 22、Yarn 1.22.22、NestJS 11、Vue 3 SSR、Docker BuildKit、Docker Compose、GitHub Actions、Nacos、Nginx。

---

### Task 1: 修复环境示例基线并建立部署契约

**Files:**

- Move: `env/.env.example` → `.env.example`
- Modify: `test/unit/env-example.test.cjs`
- Create: `test/unit/deployment-contract.test.cjs`

- [ ] **Step 1: 保留当前失败证据**

Run: `yarn test:unit`

Expected: `env-example.test.cjs` 因根目录 `.env.example` 不存在而失败。

- [ ] **Step 2: 写部署契约测试**

测试读取 `Dockerfile`、`deploy/compose.yml`、`deploy/deploy.sh`、`deploy/bootstrap-nacos-config.cjs`、`deploy/shared-ingress.conf` 和 `.github/workflows/deploy.yml`，断言：非 root 运行、ready 健康检查、完整 SHA 镜像、Home Runner、外部网络、日志轮转、动态 DNS、失败回滚，以及所有部署命令均不含 `--remove-orphans`。

- [ ] **Step 3: 验证新契约失败**

Run: `node --test test/unit/deployment-contract.test.cjs`

Expected: 因 `Dockerfile` 或部署文件不存在而失败。

- [ ] **Step 4: 恢复根目录环境示例**

根目录 `.env.example` 固定包含 `NODE_ENV`、`PORT`、`NACOS_SERVER`、`NACOS_NAMESPACE`，并保留可选 Nacos 用户名和密码注释；删除 `env/.env.example`。

- [ ] **Step 5: 验证环境示例测试恢复**

Run: `node --test test/unit/env-example.test.cjs`

Expected: 2 tests pass, 0 fail。

### Task 2: 实现并测试 Nacos 配置边界

**Files:**

- Create: `deploy/bootstrap-nacos-config.cjs`
- Create: `test/unit/bootstrap-nacos-config.test.cjs`

- [ ] **Step 1: 写失败测试**

测试 `createSkylineConfig()` 精确返回 `server.port=4020`，并测试 `sanitizeSkylineConfig()` 把旧端口改为 4020、删除 `database` 等非 `server` 根节点。

- [ ] **Step 2: 验证测试失败**

Run: `node --test test/unit/bootstrap-nacos-config.test.cjs`

Expected: module not found。

- [ ] **Step 3: 实现最小 Nacos 引导器**

实现 Nacos GET/POST、缺失配置创建、现有配置净化和中文错误输出。脚本从 `NACOS_SERVER`、`NACOS_NAMESPACE`、`NACOS_CONFIG_DATA_ID` 与 group 环境变量读取目标，不记录密钥。

- [ ] **Step 4: 验证测试通过**

Run: `node --test test/unit/bootstrap-nacos-config.test.cjs`

Expected: all tests pass。

### Task 3: 实现 Docker 与回滚部署

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `deploy/compose.yml`
- Create: `deploy/deploy.sh`
- Create: `deploy/.env.example`
- Create: `deploy/shared-ingress.conf`

- [ ] **Step 1: 编写多阶段 Dockerfile**

依赖安装通过 `github_token` BuildKit Secret 访问 `@wlisfes`，构建复制 `dist/` 和 `build/`，运行阶段使用 `USER node`、`EXPOSE 4020`、ready 健康检查及 `CMD ["node", "dist/main.js"]`。

- [ ] **Step 2: 编写 Compose**

定义 `chat-web-service/skyline-service`、`chat-web-skyline-service`、`json-file` 20m×30、`restart: unless-stopped`、`init: true`、`.env`、`expose: 4020` 和外部 `chat-web-infrastructure`。

- [ ] **Step 3: 编写部署器**

部署器验证 `.env`、Compose 和网络，重试拉取，执行 `up -d --no-deps skyline-service`，轮询健康状态，验证容器内 ready 端点；失败或被新版本中断时恢复旧镜像。

- [ ] **Step 4: 编写共享入口**

`skyline.lisfes.com` 使用现有证书，HTTP 跳转 HTTPS；location 内用 `resolver 127.0.0.11` 和变量形式代理 `chat-web-skyline-service:4020`。

- [ ] **Step 5: 验证部署契约转绿**

Run: `node --test test/unit/deployment-contract.test.cjs && sh -n deploy/deploy.sh`

Expected: all tests pass；shell syntax valid。

### Task 4: 实现 main 自动构建部署

**Files:**

- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 编写 verify job**

使用 `actions/checkout@v4`、Node 22、Yarn cache 和 GitHub Packages `GITHUB_TOKEN`，运行冻结安装及 `yarn test`。

- [ ] **Step 2: 编写 build job**

Buildx 构建一次，发布 `ghcr.io/wlisfes/chat-web-skyline-service:${GITHUB_SHA}` 和 `latest`，使用 GHA cache 与 BuildKit `github_token` secret。

- [ ] **Step 3: 编写 Home deploy job**

使用 `[self-hosted, linux, chat-server-home]`、`production-home`、`deploy-home` concurrency；安装部署文件、初始化但不覆盖机器 `.env`、执行 Nacos 引导、部署完整 SHA，并验证容器与域名 ready 端点。

- [ ] **Step 4: 验证 Workflow 静态契约**

Run: `node --test test/unit/deployment-contract.test.cjs`

Expected: workflow assertions pass。

### Task 5: 文档、完整测试与本地镜像验收

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md`
- Create: `deploy/RUNBOOK.md`
- Create: `deploy/CHANGELOG.md`

- [ ] **Step 1: 更新运行和部署文档**

记录 Home-only 明确例外、容器/网络/端口/Nacos/Runner/域名、首次初始化、日志轮转、验证和回滚；移除“仓库没有 Docker”的过期说明。

- [ ] **Step 2: 执行完整项目验证**

Run: `yarn format:check && yarn typecheck && yarn test`

Expected: 0 failures。

- [ ] **Step 3: 验证 Compose 和镜像**

Run: `IMAGE=chat-web-skyline-service:local docker compose --env-file deploy/.env.example -f deploy/compose.yml config`

Run: `docker build --secret id=github_token,env=NODE_AUTH_TOKEN -t chat-web-skyline-service:local .`

Expected: Compose renders；image build succeeds。

- [ ] **Step 4: 验证运行镜像**

使用单独 Compose 项目和测试网络启动本地镜像，确认非 root 用户、healthy、`/health/ready`、SSR 首页、静态脚本和结构化日志，随后只删除测试容器。

### Task 6: 分支集成、Runner 与 Home 发布

**Files:**

- Machine-only: `/opt/chat-web-skyline-service/.env`
- Machine-only: Home shared Nginx volume `skyline.conf`

- [ ] **Step 1: 提交临时分支并合并 developer**

将测试、Docker、Actions 和文档提交到本地临时分支，快进/合并到 `developer` 后推送 `origin/developer`。

- [ ] **Step 2: 合并 main 并清理分支**

基于最新 `origin/main` 合并 `developer`，推送 `main` 触发流水线；临时分支合并到两个稳定分支后本地删除，不创建远程临时分支。

- [ ] **Step 3: 安装仓库专用 Home Runner**

在 `/home/runner/actions-runner-skyline` 安装专用 Runner，标签为 `chat-server-home`，systemd 服务只绑定 `Wlisfes/chat-web-skyline-service`。

- [ ] **Step 4: 初始化 Home 机器配置**

从本机现有 Nacos Namespace 创建权限为 0600 的 Skyline `.env`；发布仅含 `server.port: 4020` 的 Nacos YAML；把版本化动态入口同步到共享 Nginx volume，在 `nginx -t` 成功后 reload。

- [ ] **Step 5: 跟踪流水线并验收**

确认 verify、build、Home deploy 成功；检查容器完整 SHA、healthy、重启计数、日志轮转、Nacos 注册、Dozzle 日志、域名 ready 与 SSR 页面。
