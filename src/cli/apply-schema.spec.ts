import mysql from 'mysql2/promise'
import { acquireSchemaMigrationLock, ensureTaskIdUniqueIndex, releaseSchemaMigrationLock, SCHEMA_MIGRATION_LOCK_NAME } from './apply-schema'

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
