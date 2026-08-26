const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { createSkylineConfig, sanitizeSkylineConfig } = require('../../deploy/bootstrap-nacos-config.cjs')

describe('Skyline Nacos bootstrap', () => {
    it('creates the minimal Skyline configuration', () => {
        assert.equal(createSkylineConfig(), 'server:\n  port: 4020\n')
    })

    it('removes unrelated root sections and normalizes the service port', () => {
        const legacy = `server:
  port: 5020
database:
  chat-web-account:
    host: mysql
security:
  enabled: true
`

        assert.equal(sanitizeSkylineConfig(legacy), 'server:\n  port: 4020\n')
    })

    it('rejects an existing document without a server root', () => {
        assert.throws(() => sanitizeSkylineConfig('database:\n  name: skyline\n'), /server/)
    })
})
