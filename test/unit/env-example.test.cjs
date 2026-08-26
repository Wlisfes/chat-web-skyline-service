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
    it('只列出进程启动与 Nacos 连接参数', () => {
        assert.deepEqual(assignments, {
            NODE_ENV: 'development',
            PORT: '4020',
            NACOS_SERVER: '127.0.0.1:8848',
            NACOS_NAMESPACE: 'replace-with-nacos-namespace-id',
            NACOS_SERVICE_NAME: 'chat-web-skyline-service'
        })
    })

    it('为每个字段提供注释', () => {
        assert.match(envExample, /# Node\.js 运行环境；本地开发使用 development\r?\nNODE_ENV=/)
        assert.match(envExample, /# 本地服务监听端口；Docker 容器不发布宿主机端口，因此可同样使用 4020\r?\nPORT=/)
        assert.match(envExample, /# Nacos 服务地址，格式为 host:port\r?\nNACOS_SERVER=/)
        assert.match(envExample, /# Nacos 命名空间 ID\r?\nNACOS_NAMESPACE=/)
        assert.match(envExample, /# 注册到 Nacos 的服务名称\r?\nNACOS_SERVICE_NAME=/)
    })
})
