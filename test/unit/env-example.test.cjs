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
    it('只包含 Skyline 正常连接 Nacos 所需的必填项', () => {
        assert.deepEqual(assignments, {
            NACOS_CONFIG_DATA_ID: 'chat-web-skyline-service.yaml',
            NACOS_CONFIG_GROUP: 'DEFAULT_GROUP'
        })
    })

    it('说明两个配置项的用途和必填性', () => {
        assert.match(envExample, /# Nacos 配置 Data ID；正常运行必填，必须对应已发布的配置。/)
        assert.match(envExample, /# Nacos 配置组；正常运行必填，同时作为默认服务发现分组。/)
    })
})
