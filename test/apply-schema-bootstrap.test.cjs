const test = require('node:test')
const assert = require('node:assert/strict')
const {
    createAdminConnectionOptions,
    createMigrationCredentials,
    createMigrationUser,
    dropMigrationUser
} = require('../dist/cli/apply-schema-bootstrap')

test('管理员连接应显式选择 Skyline 数据库', () => {
    assert.deepEqual(
        createAdminConnectionOptions(
            {
                host: 'mysql.example',
                port: 3306,
                username: 'admin',
                password: 'secret'
            },
            'chat_web_skyline'
        ),
        {
            host: 'mysql.example',
            port: 3306,
            user: 'admin',
            password: 'secret',
            database: 'chat_web_skyline',
            charset: 'utf8mb4'
        }
    )
})

test('生成的账号长度和字符集符合 MySQL 限制', () => {
    const credentials = createMigrationCredentials(Buffer.alloc(18, 1))
    assert.match(credentials.username, /^skyline_mig_[0-9a-f]+$/)
    assert.equal(credentials.username.length <= 32, true)
    assert.match(credentials.password, /^[A-Za-z0-9_-]+$/)
})

test('只授权目标数据库并支持回收账号', async () => {
    const calls = []
    const connection = {
        async query(sql) {
            calls.push(sql)
        }
    }
    const credentials = { username: 'skyline_mig_test', password: 'secret' }
    await createMigrationUser(connection, 'chat-web-skyline', credentials)
    await dropMigrationUser(connection, credentials)
    assert.equal(calls[0], "CREATE USER 'skyline_mig_test'@'%' IDENTIFIED BY 'secret'")
    assert.equal(calls[1], "GRANT ALL PRIVILEGES ON `chat-web-skyline`.* TO 'skyline_mig_test'@'%'")
    assert.equal(calls[2], "DROP USER IF EXISTS 'skyline_mig_test'@'%'")
})
