const test = require('node:test')
const assert = require('node:assert/strict')
const {
    acquireSchemaMigrationLock,
    ensureChunkModuleColumn,
    ensureTaskIdUniqueIndex,
    releaseSchemaMigrationLock,
    SCHEMA_MIGRATION_LOCK_NAME,
    shouldRepairSkylineMigrationChecksum
} = require('../dist/cli/apply-schema')

function createConnection(results) {
    const calls = []
    let index = 0
    return {
        calls,
        async query(sql, parameters) {
            calls.push({ sql, parameters })
            const current = results[index++]
            if (typeof current === 'function') return current(sql, parameters)
            return current
        }
    }
}

test('迁移台账漂移时应在实际迁移连接上补齐 module 列', async () => {
    const connection = createConnection([
        [[{ count: 1 }], []],
        [[{ count: 0 }], []],
        [[], []]
    ])
    assert.equal(await ensureChunkModuleColumn(connection), true)
    assert.equal(connection.calls.length, 3)
    assert.match(connection.calls[2].sql, /ADD COLUMN `module`/)
})

test('枚举表不存在时不应提前执行补列 DDL', async () => {
    const connection = createConnection([[[{ count: 0 }], []]])
    assert.equal(await ensureChunkModuleColumn(connection), false)
    assert.equal(connection.calls.length, 1)
})

test('已存在单列唯一索引时不重复执行 DDL', async () => {
    const connection = createConnection([
        [[{ indexName: 'uk_tb_skyline_datetask_system_task_id', nonUnique: 0, columnCount: 1, hasTaskId: 1 }], []]
    ])
    await ensureTaskIdUniqueIndex(connection)
    assert.equal(connection.calls.length, 1)
})

test('存在旧普通索引时替换为唯一索引', async () => {
    const connection = createConnection([
        [[{ indexName: 'idx_tb_skyline_datetask_system_task_id', nonUnique: 1, columnCount: 1, hasTaskId: 1 }], []],
        [[], []]
    ])
    await ensureTaskIdUniqueIndex(connection)
    assert.equal(connection.calls.length, 2)
    assert.match(connection.calls[1].sql, /DROP INDEX `idx_tb_skyline_datetask_system_task_id`/)
    assert.match(connection.calls[1].sql, /ADD UNIQUE KEY `uk_tb_skyline_datetask_system_task_id`/)
})

test('没有 task_id 索引时直接创建唯一索引', async () => {
    const connection = createConnection([
        [[], []],
        [[], []]
    ])
    await ensureTaskIdUniqueIndex(connection)
    assert.equal(connection.calls.length, 2)
    assert.match(connection.calls[1].sql, /ADD UNIQUE KEY `uk_tb_skyline_datetask_system_task_id`/)
})

test('获取锁超时时应抛出中文错误', async () => {
    const connection = createConnection([[[{ acquired: 0 }], []]])
    await assert.rejects(() => acquireSchemaMigrationLock(connection), /获取 Skyline Schema 迁移锁超时/)
    assert.deepEqual(connection.calls[0], { sql: 'SELECT GET_LOCK(?, 30) AS acquired', parameters: [SCHEMA_MIGRATION_LOCK_NAME] })
})

test('获取并释放锁时使用固定锁名', async () => {
    const connection = createConnection([
        [[{ acquired: 1 }], []],
        [[], []]
    ])
    await acquireSchemaMigrationLock(connection)
    await releaseSchemaMigrationLock(connection)
    assert.deepEqual(connection.calls[1], { sql: 'SELECT RELEASE_LOCK(?)', parameters: [SCHEMA_MIGRATION_LOCK_NAME] })
})

test('仅允许修复枚举模块归一化迁移的历史校验和', () => {
    assert.equal(shouldRepairSkylineMigrationChecksum('20260912130000__tb_skyline_chunk__normalize_module.sql'), true)
    assert.equal(shouldRepairSkylineMigrationChecksum('20260912120000__tb_skyline_chunk__add_module.sql'), false)
})
