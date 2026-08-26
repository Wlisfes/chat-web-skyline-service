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

    it('为每个字段提供注释', () => {
        assert.match(envExample, /# 运行环境\r?\nNODE_ENV=/)
        assert.match(envExample, /# 服务端口\r?\nPORT=/)
        assert.match(envExample, /# Nacos 服务地址\r?\nNACOS_SERVER=/)
        assert.match(envExample, /# Nacos 命名空间 ID\r?\nNACOS_NAMESPACE=/)
        assert.match(envExample, /# Nacos 用户名（可选）\r?\n# NACOS_USERNAME=/)
        assert.match(envExample, /# Nacos 密码（可选）\r?\n# NACOS_PASSWORD=/)
    })
})
