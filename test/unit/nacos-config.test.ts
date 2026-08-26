import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isNacosConfigEnabled } from '../../src/config/nacos-config'

describe('isNacosConfigEnabled', () => {
    it('defaults to enabled and accepts explicit booleans', () => {
        assert.equal(isNacosConfigEnabled(undefined), true)
        assert.equal(isNacosConfigEnabled(''), true)
        assert.equal(isNacosConfigEnabled('true'), true)
        assert.equal(isNacosConfigEnabled('false'), false)
    })

    it('rejects an invalid value', () => {
        assert.throws(() => isNacosConfigEnabled('off'), /true 或 false/)
    })
})
