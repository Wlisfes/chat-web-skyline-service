const test = require('node:test')
const assert = require('node:assert/strict')
const { CountryService } = require('../dist/modules/country/country.service')

function fakeTransactionalRepository() {
    const state = { transactions: 0, creates: [], merges: [], saves: [] }
    const manager = {
        create(entity, values) {
            state.creates.push({ entity, values })
            return { ...values }
        },
        merge(entity, target, values) {
            state.merges.push({ entity, target, values })
            Object.assign(target, values)
            return target
        },
        async save(entity) {
            state.saves.push(entity)
            return entity
        }
    }
    const repository = {
        state,
        manager: {
            async transaction(callback) {
                state.transactions += 1
                return callback(manager)
            }
        }
    }
    return { manager, repository }
}

test('国家状态更新在事务内锁定实体后写入', async () => {
    const countryTransactional = fakeTransactionalRepository()
    const country = { keyId: 1, status: 'enable' }
    const countryUtilsService = {
        async findRequired(keyId, manager) {
            assert.equal(keyId, 1)
            assert.equal(manager, countryTransactional.manager)
            return country
        }
    }
    const countryService = new CountryService(countryTransactional.repository, {}, countryUtilsService)
    await countryService.httpBaseSkylineCountryStatusUpdate({ uid: '1001' }, { keyId: 1, status: 'disable' })
    assert.equal(countryTransactional.repository.state.transactions, 1)
    assert.equal(country.status, 'disable')
    assert.equal(country.modifyBy, '1001')
})

test('国家地区列表通过 Skyline 账号 Feign 还原创建人和更新人', async () => {
    const items = [
        { keyId: 1, cnName: '中国', createBy: '0', modifyBy: '1001' },
        { keyId: 2, cnName: '美国', createBy: '1001', modifyBy: null }
    ]
    const calls = []
    const qb = {
        andWhere() {
            return qb
        },
        orderBy() {
            return qb
        },
        skip() {
            return qb
        },
        take() {
            return qb
        },
        async getManyAndCount() {
            return [items, 2]
        }
    }
    const database = { builder: (repository, callback) => callback(qb) }
    const skylineFeignClient = {
        async httpBaseSkylineColumnUserResolver(authorization, body) {
            calls.push({ authorization, body })
            return [{ uid: '1001', number: '1001', name: '张三' }]
        }
    }
    const configService = { get: () => 'service-token' }
    const service = new CountryService({}, database, {}, skylineFeignClient, configService)

    const result = await service.httpBaseSkylineColumnCountry({ page: 1, size: 10 })
    assert.equal(result.total, 2)
    assert.deepEqual(calls, [{ authorization: 'Bearer service-token', body: { uids: ['1001'] } }])
    assert.deepEqual(result.list[0].createByOptions, { uid: '0', name: '系统' })
    assert.deepEqual(result.list[0].modifyByOptions, { uid: '1001', number: '1001', name: '张三' })
    assert.deepEqual(result.list[1].createByOptions, { uid: '1001', number: '1001', name: '张三' })
    assert.equal(result.list[1].modifyByOptions, undefined)
})

test('国家/地区 Feign 批量查询去重、过滤非法主键并限制 100 个', async () => {
    const calls = []
    const repository = {
        async find(options) {
            calls.push(options)
            return [{ keyId: 1000, code: '86', mcc: '460', cnName: '中国', enName: 'China', status: 'enable' }]
        }
    }
    const service = new CountryService(repository, {}, {})
    assert.deepEqual(await service.httpBaseSkylineColumnCountryResolver({ keyIds: [] }), [])
    const list = await service.httpBaseSkylineColumnCountryResolver({ keyIds: [1000, 1000, 0, -1] })
    assert.equal(list[0].code, '86')
    assert.deepEqual(calls[0].where.keyId._value, [1000])
    await assert.rejects(
        () => service.httpBaseSkylineColumnCountryResolver({ keyIds: Array.from({ length: 101 }, (_, index) => index + 1) }),
        /单次最多查询100个国家\/地区/
    )
})

test('国家/地区 Feign 单条查询不存在时返回 404', async () => {
    const service = new CountryService({ find: async () => [] }, {}, {})
    await assert.rejects(
        () => service.httpBaseSkylineCountryResolver({ keyId: 9999 }),
        error => error?.status === 404
    )
})
