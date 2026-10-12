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
