const test = require('node:test')
const assert = require('node:assert/strict')
const { FeignController } = require('../dist/feign/feign.controller')
const { FeignService } = require('../dist/feign/feign.service')

function config(values) {
    return {
        get(key, fallback) {
            return values[key] ?? fallback
        }
    }
}

test('Skyline 账号还原 Feign 只接受服务间凭据并在账号不存在时返回 404', async () => {
    const users = [{ uid: '2149446185344106496', number: 'A1', name: '张三' }]
    const controller = new FeignController(
        new FeignService(
            {},
            {
                async httpBaseSkylineColumnUserResolver(input) {
                    return users.filter(user => input.uids.includes(user.uid))
                }
            }
        ),
        config({ 'gateway.feign.service_token': 'service-token' })
    )

    assert.equal(FeignController.prototype.httpBaseSkylineBatchUserResolver, undefined)
    assert.deepEqual(await controller.httpBaseSkylineColumnUserResolver('Bearer service-token', { uids: ['2149446185344106496'] }), users)
    assert.deepEqual(await controller.httpBaseSkylineUserResolver('Bearer service-token', { uid: '2149446185344106496' }), users[0])
    await assert.rejects(
        () => controller.httpBaseSkylineUserResolver('Bearer service-token', { uid: '2149446185344106497' }),
        error => error?.status === 404
    )
    await assert.rejects(
        () => controller.httpBaseSkylineUserResolver('Bearer service-token', { uid: 'missing' }),
        error => error?.status === 400
    )
    await assert.rejects(
        () => controller.httpBaseSkylineColumnUserResolver('Bearer user-token', { uids: ['2149446185344106496'] }),
        error => error?.status === 401
    )
    await assert.rejects(
        () => controller.httpBaseSkylineUserResolver('Bearer user-token', { uid: '2149446185344106496' }),
        error => error?.status === 401
    )
})

test('Skyline 国家/地区 Feign 只接受服务间凭据', async () => {
    const country = { keyId: 1000, code: '86', mcc: '460', cnName: '中国', enName: 'China', status: 'enable' }
    const controller = new FeignController(
        new FeignService(
            {},
            {},
            {
                async httpBaseSkylineColumnCountryResolver(input) {
                    return input.keyIds.includes(1000) ? [country] : []
                },
                async httpBaseSkylineCountryResolver(input) {
                    return { ...country, keyId: input.keyId }
                }
            }
        ),
        config({ 'gateway.feign.service_token': 'service-token' })
    )
    assert.deepEqual(await controller.httpBaseSkylineColumnCountryResolver('Bearer service-token', { keyIds: [1000] }), [country])
    assert.equal((await controller.httpBaseSkylineCountryResolver('Bearer service-token', { keyId: 1000 })).code, '86')
    await assert.rejects(
        () => controller.httpBaseSkylineColumnCountryResolver('Bearer user-token', { keyIds: [1000] }),
        error => error?.status === 401
    )
})
