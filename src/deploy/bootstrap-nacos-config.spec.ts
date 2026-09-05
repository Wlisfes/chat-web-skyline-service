import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 部署脚本运行在 node:22-alpine 中，不能依赖 Skyline 的 node_modules；测试直接加载其 CommonJS 导出。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createSkylineConfig, sanitizeSkylineConfig } = require('../../deploy/bootstrap-nacos-config.cjs') as {
    createSkylineConfig: (environment: Record<string, string>) => string
    sanitizeSkylineConfig: (content: string, options?: { requireServiceToken?: boolean }) => string
}

describe('Skyline Nacos 部署配置校准', () => {
    const database = `database:
  chat-web-skyline:
    host: "chat-web-mysql"
    port: 3306
    name: "chat_web_skyline"
    username: "skyline"
    password: "keep-this-password"`

    // 业务服务只校验网关签发的身份上下文，密钥必须与网关配置完全一致。
    const principal = `gateway:
  principal:
    secret: "0123456789abcdef0123456789abcdef"
    maxAgeSeconds: 60`

    // Feign 客户端分别读取目标服务地址，网关身份上下文单独配置。
    const feign = `feign:
  service_token: "keep-this-token"
  chat-web-account:
    url: "http://chat-web-account-service:5010"
    timeout: 3000
  chat-web-finance:
    url: "http://chat-web-finance-service:5030"
    timeout: 3000
  chat-web-crm:
    url: "http://chat-web-crm-service:5020"
    timeout: 3000`

    it('应校验现有配置并保持 Feign 与敏感字段原样', () => {
        const source = `server:
  port: 5040
${feign}
${principal}
${database}
`

        const result = sanitizeSkylineConfig(source)

        expect(result).toContain('port: 5040')
        expect(result).toContain('password: "keep-this-password"')
        expect(result).toContain('service_token: "keep-this-token"')
        expect(result).toContain('chat-web-finance:')
    })

    it('缺少 Skyline 数据库节点时应拒绝校准', () => {
        expect(() => sanitizeSkylineConfig('server:\n  port: 5040\nfeign:\n  service_token: token')).toThrow('database.chat-web-skyline')
    })

    it('缺少服务间凭据时应拒绝校准，不能使用主机环境变量绕过', () => {
        const source = `server:
  port: 5040
${database}`

        expect(() => sanitizeSkylineConfig(source)).toThrow('feign 节点')
        expect(() =>
            sanitizeSkylineConfig(
                `${source}\nfeign:\n  chat-web-account:\n    url: http://chat-web-account-service:5010\n    timeout: 3000\n  chat-web-finance:\n    url: http://chat-web-finance-service:5030\n    timeout: 3000\n  chat-web-crm:\n    url: http://chat-web-crm-service:5020\n    timeout: 3000`
            )
        ).toThrow('feign.service_token')
    })

    it('缺少网关身份上下文密钥时应拒绝校准', () => {
        const source = `server:
  port: 5040
${feign}
${database}`

        expect(() => sanitizeSkylineConfig(source)).toThrow('gateway.principal.secret')
    })

    it('完整配置再次执行应保持幂等', () => {
        const source = `server:
  port: 5040
${database}
${feign}
${principal}
`

        expect(sanitizeSkylineConfig(source)).toBe(source)
    })

    it('辅助配置生成函数不会被部署主流程自动调用，且只接受显式凭据', () => {
        const source = createSkylineConfig({
            SKYLINE_MYSQL_DATABASE: 'chat_web_skyline',
            SKYLINE_MYSQL_HOST: 'chat-web-mysql',
            SKYLINE_MYSQL_USERNAME: 'skyline',
            SKYLINE_MYSQL_PASSWORD: 'database-password',
            FINANCE_SERVICE_TOKEN: 'finance-token',
            GATEWAY_PRINCIPAL_SECRET: '0123456789abcdef0123456789abcdef'
        })
        expect(source).toContain('name: "chat_web_skyline"')
        expect(source).toContain('service_token: "finance-token"')
        expect(source).toContain('url: "http://chat-web-finance-service:5030"')
        expect(source).toContain('secret: "0123456789abcdef0123456789abcdef"')

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
