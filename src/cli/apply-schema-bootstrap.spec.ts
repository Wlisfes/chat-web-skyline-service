import mysql from 'mysql2/promise'
import { createMigrationCredentials, createMigrationUser, dropMigrationUser } from './apply-schema-bootstrap'

describe('Skyline Schema 临时迁移账号', () => {
    it('生成的账号长度和字符集符合 MySQL 限制', () => {
        const credentials = createMigrationCredentials(Buffer.alloc(18, 1))

        expect(credentials.username).toMatch(/^skyline_mig_[0-9a-f]+$/)
        expect(credentials.username.length).toBeLessThanOrEqual(32)
        expect(credentials.password).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('只授权目标数据库并支持回收账号', async () => {
        const connection = { query: jest.fn() } as unknown as mysql.Connection
        const query = connection.query as jest.Mock
        const credentials = { username: 'skyline_mig_test', password: 'secret' }

        await createMigrationUser(connection, 'chat-web-skyline', credentials)
        await dropMigrationUser(connection, credentials)

        expect(query.mock.calls[0][0]).toBe("CREATE USER 'skyline_mig_test'@'%' IDENTIFIED BY 'secret'")
        expect(query.mock.calls[1][0]).toBe("GRANT ALL PRIVILEGES ON `chat-web-skyline`.* TO 'skyline_mig_test'@'%'")
        expect(query.mock.calls[2][0]).toBe("DROP USER IF EXISTS 'skyline_mig_test'@'%'")
    })
})
