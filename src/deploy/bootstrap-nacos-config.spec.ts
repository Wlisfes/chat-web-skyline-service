import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 部署脚本运行在 node:22-alpine 中，不能依赖 Skyline 的 node_modules；测试直接加载其 CommonJS 导出。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createSkylineConfig, sanitizeSkylineConfig } = require('../../deploy/bootstrap-nacos-config.cjs') as {
    createSkylineConfig: (environment: Record<string, string>) => string
    sanitizeSkylineConfig: (
        content: string,
        environment?: Record<string, string | undefined>,
        options?: { requireServiceToken?: boolean }
    ) => string
}

describe('Skyline Nacos 部署配置校准', () => {
    const database = `database:
  chat-web-skyline:
    host: "chat-web-mysql"
    port: 3306
    name: "chat_web_skyline"
    username: "skyline"
    password: "keep-this-password"`

    it('应固定端口、补齐汇率任务默认项并保留已有敏感配置', () => {
        const source = `server:
  port: 4020
${database}
security:
  serviceToken: "keep-this-token"
`

        const result = sanitizeSkylineConfig(source, {})

        expect(result).toContain('port: 5040')
        expect(result).not.toContain('port: 4020')
        expect(result).toContain('password: "keep-this-password"')
        expect(result).toContain('serviceToken: "keep-this-token"')
        expect(result).toContain('FINANCE_SERVICE_URL: "http://chat-web-finance-service:5030"')
        expect(result).toContain('SKYLINE_FRANKFURTER_URL: "https://api.frankfurter.dev/v2/rates"')
        expect(result).toContain('FRANKFURTER_TIMEOUT_MS: 10000')
    })

    it('缺少 Skyline 数据库节点时应拒绝校准', () => {
        expect(() => sanitizeSkylineConfig('server:\n  port: 5040\nsecurity:\n  serviceToken: token')).toThrow('database.chat-web-skyline')
    })

    it('缺少服务间凭据时应拒绝校准，但允许明确的主机临时覆盖', () => {
        const source = `server:
  port: 5040
${database}`

        expect(() => sanitizeSkylineConfig(source, {})).toThrow('security.serviceToken')
        expect(sanitizeSkylineConfig(source, { FINANCE_SERVICE_TOKEN: 'host-only-token' })).toContain('port: 5040')
    })

    it('完整配置再次执行应保持幂等', () => {
        const source = `server:
  port: 5040
${database}
security:
  serviceToken: token

# Finance 服务的内部 Feign 地址。
FINANCE_SERVICE_URL: "http://chat-web-finance-service:5030"
# Finance 服务 Feign 请求超时时间（毫秒）。
FINANCE_SERVICE_TIMEOUT_MS: 5000
# Frankfurter 汇率接口地址。
SKYLINE_FRANKFURTER_URL: "https://api.frankfurter.dev/v2/rates"
# Frankfurter 请求超时时间（毫秒）。
FRANKFURTER_TIMEOUT_MS: 10000
`

        expect(sanitizeSkylineConfig(source, {})).toBe(source)
    })

    it('辅助配置生成函数不会被部署主流程自动调用，且只接受显式凭据', () => {
        const source = createSkylineConfig({
            SKYLINE_MYSQL_DATABASE: 'chat_web_skyline',
            SKYLINE_MYSQL_HOST: 'chat-web-mysql',
            SKYLINE_MYSQL_USERNAME: 'skyline',
            SKYLINE_MYSQL_PASSWORD: 'database-password',
            FINANCE_SERVICE_TOKEN: 'finance-token'
        })
        expect(source).toContain('name: "chat_web_skyline"')
        expect(source).toContain('serviceToken: "finance-token"')

        const script = readFileSync(resolve(__dirname, '../../deploy/bootstrap-nacos-config.cjs'), 'utf8')
        expect(script).toContain('if (!existing)')
        expect(script).not.toContain('process.stdout.write(existing')
    })

    it('流水线必须在切换容器前安装并执行配置校准脚本', () => {
        const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/deploy.yml'), 'utf8')
        const installIndex = workflow.indexOf('deploy/bootstrap-nacos-config.cjs "$DEPLOY_PATH/bootstrap-nacos-config.cjs"')
        const bootstrapIndex = workflow.indexOf('node bootstrap-nacos-config.cjs')
        const deployIndex = workflow.indexOf('DEPLOYMENT_ENVIRONMENT="$DEPLOYMENT_ENVIRONMENT" ./deploy.sh "$IMAGE" compose.yml')
        expect(installIndex).toBeGreaterThanOrEqual(0)
        expect(bootstrapIndex).toBeGreaterThan(installIndex)
        expect(deployIndex).toBeGreaterThan(bootstrapIndex)
    })
})
