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
            NACOS_NAMESPACE: 'replace-with-nacos-namespace-id'
        })
    })

    it('说明其余配置来自 Nacos 远端 Data ID', () => {
        assert.match(envExample, /Nacos 远端 chat-web-skyline-service.yaml/)
    })
})
