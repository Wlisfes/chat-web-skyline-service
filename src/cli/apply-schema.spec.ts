import mysql from 'mysql2/promise'
import {
    acquireSchemaMigrationLock,
    ensureChunkModuleColumn,
    ensureTaskIdUniqueIndex,
    releaseSchemaMigrationLock,
    SCHEMA_MIGRATION_LOCK_NAME,
    shouldRepairSkylineMigrationChecksum
} from './apply-schema'

describe('Skyline 枚举表兼容修复', () => {
    it('迁移台账漂移时应在实际迁移连接上补齐 module 列', async () => {
        const connection = { query: jest.fn() } as unknown as mysql.Connection
        const query = connection.query as jest.Mock
        query
            .mockResolvedValueOnce([[{ count: 1 }], []])
            .mockResolvedValueOnce([[{ count: 0 }], []])
            .mockResolvedValueOnce([[], []])

        await expect(ensureChunkModuleColumn(connection)).resolves.toBe(true)
        expect(query).toHaveBeenCalledTimes(3)
        expect(query.mock.calls[2][0]).toContain('ADD COLUMN `module`')
    })

    it('枚举表不存在时不应提前执行补列 DDL', async () => {
        const connection = { query: jest.fn() } as unknown as mysql.Connection
        const query = connection.query as jest.Mock
        query.mockResolvedValueOnce([[{ count: 0 }], []])

        await expect(ensureChunkModuleColumn(connection)).resolves.toBe(false)
        expect(query).toHaveBeenCalledTimes(1)
    })
})

describe('ensureTaskIdUniqueIndex', () => {
    const createConnection = () => ({ query: jest.fn() }) as unknown as mysql.Connection

    it('已存在单列唯一索引时不重复执行 DDL', async () => {
        const connection = createConnection()
        const query = connection.query as jest.Mock
        query.mockResolvedValueOnce([
            [{ indexName: 'uk_tb_skyline_datetask_system_task_id', nonUnique: 0, columnCount: 1, hasTaskId: 1 }],
            []
        ])

        await ensureTaskIdUniqueIndex(connection)

        expect(query).toHaveBeenCalledTimes(1)
    })

    it('存在旧普通索引时替换为唯一索引', async () => {
        const connection = createConnection()
        const query = connection.query as jest.Mock
        query.mockResolvedValueOnce([
            [{ indexName: 'idx_tb_skyline_datetask_system_task_id', nonUnique: 1, columnCount: 1, hasTaskId: 1 }],
            []
        ])
        query.mockResolvedValueOnce([[], []])

        await ensureTaskIdUniqueIndex(connection)

        expect(query).toHaveBeenCalledTimes(2)
        expect(query.mock.calls[1][0]).toContain('DROP INDEX `idx_tb_skyline_datetask_system_task_id`')
        expect(query.mock.calls[1][0]).toContain('ADD UNIQUE KEY `uk_tb_skyline_datetask_system_task_id`')
    })

    it('没有 task_id 索引时直接创建唯一索引', async () => {
        const connection = createConnection()
        const query = connection.query as jest.Mock
        query.mockResolvedValueOnce([[], []])
        query.mockResolvedValueOnce([[], []])

        await ensureTaskIdUniqueIndex(connection)

        expect(query).toHaveBeenCalledTimes(2)
        expect(query.mock.calls[1][0]).toContain('ADD UNIQUE KEY `uk_tb_skyline_datetask_system_task_id`')
    })
})

describe('Schema 迁移锁', () => {
    const createConnection = () => ({ query: jest.fn() }) as unknown as mysql.Connection

    it('获取锁超时时应抛出中文错误', async () => {
        const connection = createConnection()
        const query = connection.query as jest.Mock
        query.mockResolvedValueOnce([[{ acquired: 0 }], []])

        await expect(acquireSchemaMigrationLock(connection)).rejects.toThrow('获取 Skyline Schema 迁移锁超时')
        expect(query).toHaveBeenCalledWith('SELECT GET_LOCK(?, 30) AS acquired', [SCHEMA_MIGRATION_LOCK_NAME])
    })

    it('获取并释放锁时使用固定锁名', async () => {
        const connection = createConnection()
        const query = connection.query as jest.Mock
        query.mockResolvedValueOnce([[{ acquired: 1 }], []]).mockResolvedValueOnce([[], []])

        await expect(acquireSchemaMigrationLock(connection)).resolves.toBeUndefined()
        await expect(releaseSchemaMigrationLock(connection)).resolves.toBeUndefined()
        expect(query.mock.calls[1]).toEqual(['SELECT RELEASE_LOCK(?)', [SCHEMA_MIGRATION_LOCK_NAME]])
    })
})

describe('Skyline 迁移校验和修复', () => {
    it('仅允许修复枚举模块归一化迁移的历史校验和', () => {
        expect(shouldRepairSkylineMigrationChecksum('20260912130000__tb_skyline_chunk__normalize_module.sql')).toBe(true)
        expect(shouldRepairSkylineMigrationChecksum('20260912120000__tb_skyline_chunk__add_module.sql')).toBe(false)
    })
})
