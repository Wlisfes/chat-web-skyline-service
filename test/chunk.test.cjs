const test = require('node:test')
const assert = require('node:assert/strict')
const { ChunkService } = require('../dist/modules/chunk/chunk.service')
const { ChunkUtilsService } = require('../dist/modules/chunk/chunk.utils.service')

test('枚举父级树按 module + type 查询并排除编辑项及其子孙节点', async () => {
    const calls = []
    const rows = [
        { keyId: 1, pid: null, module: 'CHUNK_CRM', type: 'area', name: '华东', value: 'east', sort: 10, status: 'enable' },
        { keyId: 2, pid: 1, module: 'CHUNK_CRM', type: 'area', name: '上海', value: 'sh', sort: 10, status: 'enable' },
        { keyId: 3, pid: 2, module: 'CHUNK_CRM', type: 'area', name: '浦东', value: 'pd', sort: 10, status: 'disable' },
        { keyId: 4, pid: 1, module: 'CHUNK_CRM', type: 'area', name: '杭州', value: 'hz', sort: 20, status: 'enable' }
    ]
    const repository = { find: async options => (calls.push(options), rows) }
    const moduleRepository = { findOne: async () => ({ keyId: 1 }) }
    const utils = new ChunkUtilsService(repository, moduleRepository, {}, {}, {})
    const service = new ChunkService(repository, moduleRepository, {}, utils)

    const tree = await service.httpBaseSkylineChunkTreeStructure({ module: 'CHUNK_CRM', type: 'area', keyId: 2 })

    assert.deepEqual(calls[0].where, { module: 'CHUNK_CRM', type: 'area' })
    assert.deepEqual(calls[0].order, { sort: 'ASC', keyId: 'ASC' })
    assert.deepEqual(
        tree.map(item => [item.keyId, item.children.map(child => child.keyId)]),
        [[1, [4]]]
    )
})

test('树形枚举分类列表按一级节点分页并返回 items', async () => {
    const rows = [
        { keyId: 1, pid: null, module: 'CHUNK_CRM', type: 'source', name: '线上', value: 'online', sort: 10, status: 'enable' },
        { keyId: 2, pid: 1, module: 'CHUNK_CRM', type: 'source', name: '官网', value: 'site', sort: 10, status: 'enable' },
        { keyId: 3, pid: null, module: 'CHUNK_CRM', type: 'source', name: '线下', value: 'offline', sort: 20, status: 'enable' },
        { keyId: 4, pid: 3, module: 'CHUNK_CRM', type: 'source', name: '展会', value: 'expo', sort: 10, status: 'disable' }
    ]
    const repository = { find: async () => rows }
    const moduleRepository = { findOne: async () => ({ kind: 'tree' }) }
    const utils = new ChunkUtilsService(repository, moduleRepository, {}, {}, {})
    utils.appendChunkOperators = async list => list
    const service = new ChunkService(repository, moduleRepository, {}, utils)

    const pageOne = await service.httpBaseSkylineColumnChunk({ page: 1, size: 1, module: 'CHUNK_CRM', type: 'source' })
    assert.equal(pageOne.total, 2)
    assert.deepEqual(
        pageOne.list.map(item => [item.keyId, item.items.map(child => child.keyId)]),
        [[1, [2]]]
    )

    const filtered = await service.httpBaseSkylineColumnChunk({ page: 1, size: 10, module: 'CHUNK_CRM', type: 'source', status: 'disable' })
    assert.deepEqual(
        filtered.list.map(item => [item.keyId, item.items.map(child => child.keyId)]),
        [[3, [4]]]
    )
})

test('枚举分类统计在数据库内聚合并补充最近更新信息', async () => {
    const calls = []
    const repository = {
        query: async (sql, params) => {
            calls.push({ sql, params })
            return [{ module: 'CHUNK_CRM', type: 'area', chunkCount: '3', modifyBy: '2', modifyTime: new Date(2026, 9, 12, 8, 30, 0) }]
        }
    }
    const feignClient = {
        httpBaseSkylineColumnUserResolver: async (_authorization, input) => input.uids.map(uid => ({ uid, name: `用户${uid}` }))
    }
    const configService = { get: () => 'service-token' }
    const utils = new ChunkUtilsService(repository, {}, {}, feignClient, configService)
    const list = [
        { keyId: 1, module: 'CHUNK_CRM', type: 'area', createBy: '1', modifyBy: '1', modifyTime: '2026-01-01 00:00:00' },
        { keyId: 2, module: 'CHUNK_CRM', type: 'empty', createBy: '1', modifyBy: '1', modifyTime: '2026-01-01 00:00:00' },
        { keyId: 3, module: 'CHUNK_CRM', type: 'area', createBy: '1', modifyBy: '1', modifyTime: '2026-01-01 00:00:00' }
    ]
    const records = await utils.appendChunkStatistics(list)

    assert.equal(calls.length, 1)
    assert.match(calls[0].sql, /ROW_NUMBER\(\) OVER/)
    assert.deepEqual(calls[0].params, ['area', 'empty'])
    assert.deepEqual(
        records.map(item => [item.keyId, item.chunkCount, item.modifyBy, item.modifyTime]),
        [
            [1, 3, '2', '2026-10-12 08:30:00'],
            [2, 0, '1', '2026-01-01 00:00:00'],
            [3, 3, '2', '2026-10-12 08:30:00']
        ]
    )
    assert.equal(list[0].chunkCount, undefined)
})
