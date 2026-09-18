const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { createSkylineConfig, sanitizeSkylineConfig } = require('../deploy/bootstrap-nacos-config.cjs')

const database = `database:
  chat-web-skyline:
    host: "chat-web-mysql"
    port: 3306
    name: "chat_web_skyline"
    username: "skyline"
    password: "keep-this-password"`

const gateway = `gateway:
  feign:
    service_token: "keep-this-token"
    url: "http://chat-web-gateway-service:5000"
    timeout: 3000
  principal:
    secret: "0123456789abcdef0123456789abcdef"
    maxAgeSeconds: 60`

test('应校验现有配置并保持 Feign 与敏感字段原样', () => {
    const source = `server:
  port: 5040
${gateway}
${database}
`
    const result = sanitizeSkylineConfig(source)
    assert.match(result, /port: 5040/)
    assert.match(result, /password: "keep-this-password"/)
    assert.match(result, /service_token: "keep-this-token"/)
    assert.match(result, /url: "http:\/\/chat-web-gateway-service:5000"/)
})

test('缺少 Skyline 数据库节点时应拒绝校准', () => {
    assert.throws(
        () => sanitizeSkylineConfig('server:\n  port: 5040\ngateway:\n  feign:\n    service_token: token'),
        /database.chat-web-skyline/
    )
})

test('缺少服务间凭据时应拒绝校准，不能使用主机环境变量绕过', () => {
    const source = `server:
  port: 5040
${database}`
    assert.throws(() => sanitizeSkylineConfig(source), /gateway.feign/)
    assert.throws(
        () => sanitizeSkylineConfig(`${source}\ngateway:\n  feign:\n    url: http://chat-web-gateway-service:5000\n    timeout: 3000`),
        /gateway.feign.service_token/
    )
})

test('缺少网关身份上下文密钥时应拒绝校准', () => {
    const source = `server:
  port: 5040
${gateway.replace(/\n  principal:[\s\S]*/, '')}
${database}`
    assert.throws(() => sanitizeSkylineConfig(source), /gateway.principal/)
})

test('完整配置再次执行应保持幂等', () => {
    const source = `server:
  port: 5040
${database}
${gateway}
`
    assert.equal(sanitizeSkylineConfig(source), source)
})

test('辅助配置生成函数不会被部署主流程自动调用，且只接受显式凭据', () => {
    const source = createSkylineConfig({
        SKYLINE_MYSQL_DATABASE: 'chat_web_skyline',
        SKYLINE_MYSQL_HOST: 'chat-web-mysql',
        SKYLINE_MYSQL_USERNAME: 'skyline',
        SKYLINE_MYSQL_PASSWORD: 'database-password',
        FINANCE_SERVICE_TOKEN: 'finance-token',
        GATEWAY_PRINCIPAL_SECRET: '0123456789abcdef0123456789abcdef'
    })
    assert.match(source, /name: "chat_web_skyline"/)
    assert.match(source, /service_token: "finance-token"/)
    assert.match(source, /url: "http:\/\/chat-web-gateway-service:5000"/)
    assert.match(source, /secret: "0123456789abcdef0123456789abcdef"/)
    const script = readFileSync(resolve(__dirname, '../deploy/bootstrap-nacos-config.cjs'), 'utf8')
    assert.match(script, /if \(!existing\)/)
    assert.doesNotMatch(script, /process.stdout.write\(existing/)
})

test('流水线必须在切换容器前安装并执行配置校准脚本', () => {
    const workflow = readFileSync(resolve(__dirname, '../.github/workflows/deploy.yml'), 'utf8')
    const installIndex = workflow.indexOf('deploy/bootstrap-nacos-config.cjs "$DEPLOY_PATH/bootstrap-nacos-config.cjs"')
    const bootstrapIndex = workflow.indexOf('node bootstrap-nacos-config.cjs')
    const deployIndex = workflow.indexOf('DEPLOYMENT_ENVIRONMENT="$DEPLOYMENT_ENVIRONMENT" ./deploy.sh "$IMAGE" compose.yml')
    assert.ok(installIndex >= 0)
    assert.ok(bootstrapIndex > installIndex)
    assert.ok(deployIndex > bootstrapIndex)
})
