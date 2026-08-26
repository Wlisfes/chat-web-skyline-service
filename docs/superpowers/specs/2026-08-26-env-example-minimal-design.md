# Skyline 最小环境变量示例设计

## 背景

`chat-web-skyline-service` 采用 Nacos-first 配置。当前 `.env.example` 同时列出了必填项、已有代码默认值的覆盖项和仅用于离线测试的开关，容易让部署方误以为所有变量都必须维护。

共享 `@wlisfes/chat-web-base-schema` 的 `NacosModule` 只要求配置订阅的 Data ID 和配置组必须存在。Nacos 地址、命名空间、认证信息、服务名、注册开关、注册地址和端口均已有默认值、自动推导逻辑或属于可选覆盖项。

## 目标

- `.env.example` 只保留正常 Nacos 启动时没有代码默认值的变量。
- 为每个保留项添加中文注释，说明用途和必填原因。
- 删除所有有默认值、可自动推导或仅用于特殊运行模式的示例项。
- 不改变运行时代码、Nacos 默认行为或现有 README 的离线运行说明。

## 最终内容

`.env.example` 只保留：

```dotenv
# Nacos 配置 Data ID；正常运行必填，必须对应已发布的配置。
NACOS_CONFIG_DATA_ID=chat-web-skyline-service.yaml

# Nacos 配置组；正常运行必填，同时作为默认服务发现分组。
NACOS_CONFIG_GROUP=DEFAULT_GROUP
```

移除 `NODE_ENV`、`PORT`、`NACOS_CONFIG_ENABLED`、`NACOS_SERVER`、`NACOS_NAMESPACE`、`NACOS_GROUP`、`NACOS_SERVICE_NAME`、`NACOS_REGISTER_ENABLED`、`NACOS_REGISTER_REQUIRED`、`NACOS_REGISTER_IP`、`NACOS_REGISTER_PORT`、`NACOS_USERNAME` 和 `NACOS_PASSWORD`。

## 验证

新增轻量静态测试，读取 `.env.example` 并验证：

- 变量集合严格等于 `NACOS_CONFIG_DATA_ID` 与 `NACOS_CONFIG_GROUP`。
- 两个变量前均有说明其用途和必填性的注释。
- 示例值分别为 Skyline Data ID 和 `DEFAULT_GROUP`。

先运行测试并确认它因当前冗余变量而失败，再精简 `.env.example` 并确认测试及完整项目验证通过。

## 范围边界

- 不修改运行时代码。
- 不修改 Docker、Actions、Runner、部署目录、Nacos 服务端配置或双机部署行为。
- 不处理工作区中已有的 `src/app.module.ts` 未提交改动。
