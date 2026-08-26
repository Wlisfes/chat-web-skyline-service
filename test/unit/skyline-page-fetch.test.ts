import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fetchSkylinePage from '../../web/pages/index/fetch'

describe('Skyline 首页模拟接口', () => {
    it('returns the common API response with service data', async () => {
        const result = await fetchSkylinePage()

        assert.equal(result.skylineApiResponse.code, 200)
        assert.equal(result.skylineApiResponse.message, '模拟接口请求成功')
        assert.equal(result.skylineApiResponse.data?.length, 3)
        assert.ok(result.skylineApiResponse.data?.some(service => service.status === 'warning'))
        assert.ok(Number.isFinite(Date.parse(result.skylineApiResponse.timestamp)))
    })
})
