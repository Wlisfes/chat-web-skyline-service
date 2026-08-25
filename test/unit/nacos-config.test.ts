import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isNacosConfigEnabled } from '../../src/config/nacos-config'

describe('isNacosConfigEnabled', () => {
    it('defaults to enabled', () => {
        assert.equal(isNacosConfigEnabled(undefined), true)
        assert.equal(isNacosConfigEnabled(''), true)
    })

    it('accepts explicit true and false values', () => {
        assert.equal(isNacosConfigEnabled('true'), true)
        assert.equal(isNacosConfigEnabled('false'), false)
    })

    it('rejects ambiguous values', () => {
        assert.throws(() => isNacosConfigEnabled('FALSE'), /NACOS_CONFIG_ENABLED 必须是 true 或 false/)
    })
})
