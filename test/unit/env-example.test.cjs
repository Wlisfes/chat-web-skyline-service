const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8')
const assignments = Object.fromEntries(
    envExample
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const separator = line.indexOf('=')
            return [line.slice(0, separator), line.slice(separator + 1)]
        })
)

describe('.env.example', () => {
    it('列出 Skyline 的完整 Nacos 启动和注册参数', () => {
        assert.deepEqual(assignments, {
            NACOS_SERVER: '127.0.0.1:8848',
            NACOS_NAMESPACE: 'replace-with-nacos-namespace-id',
            NACOS_REQUEST_TIMEOUT: '5000',
            NACOS_CONFIG_DATA_ID: 'chat-web-skyline-service.yaml',
            NACOS_CONFIG_GROUP: 'DEFAULT_GROUP',
            NACOS_REGISTER_ENABLED: 'true',
            NACOS_REGISTER_REQUIRED: 'false',
            NACOS_SERVICE_NAME: 'chat-web-skyline-service',
            NACOS_GROUP: 'DEFAULT_GROUP',
            NACOS_REGISTER_IP: '127.0.0.1',
            NACOS_REGISTER_PORT: '4020',
            NACOS_CONFIG_ENABLED: 'true',
            PORT: '4020'
        })
    })

    it('区分必填启动参数和带默认值的可选覆盖', () => {
        assert.match(envExample, /# 正常连接 Nacos 唯一没有代码默认值的两个启动参数。/)
        assert.match(envExample, /# 配置订阅可选覆盖；默认依次为 5000、服务名.yaml 和 DEFAULT_GROUP。/)
        assert.match(envExample, /# 服务注册可选覆盖；默认开启、失败不阻止启动、发现组跟随配置组、IP 自动探测。/)
    })
})
