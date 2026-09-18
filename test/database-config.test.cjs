const test = require('node:test')
const assert = require('node:assert/strict')
const { getDatabaseName, identifier, loadSkylineDatabaseConfig } = require('../dist/cli/database-config')

const originalEnvironment = { ...process.env }
const originalFetch = global.fetch

function restoreEnvironment() {
    for (const key of Object.keys(process.env)) {
        if (!(key in originalEnvironment)) delete process.env[key]
    }
    for (const [key, value] of Object.entries(originalEnvironment)) process.env[key] = value
    global.fetch = originalFetch
}

test('应校验数据库标识符并解析数据库名称', () => {
    assert.equal(identifier('chat_web_skyline', '数据库名称'), 'chat_web_skyline')
    assert.throws(() => identifier('chat web skyline', '数据库名称'), /数据库名称只能包含字母、数字、下划线和连字符/)
    assert.equal(
        getDatabaseName({ host: 'localhost', username: 'chat', password: 'secret', database: 'chat_web_skyline' }),
        'chat_web_skyline'
    )
    assert.throws(() => getDatabaseName({ host: 'localhost', username: 'chat', password: 'secret' }), /Skyline 数据库名称不能为空/)
})

test('应优先读取 SKYLINE_MYSQL_* 直接覆盖配置', async () => {
    restoreEnvironment()
    process.env.SKYLINE_MYSQL_HOST = 'mysql.example'
    process.env.SKYLINE_MYSQL_USERNAME = 'skyline'
    process.env.SKYLINE_MYSQL_PASSWORD = 'secret'
    process.env.SKYLINE_MYSQL_DATABASE = 'chat_web_skyline'
    process.env.SKYLINE_MYSQL_PORT = '3307'
    try {
        assert.deepEqual(await loadSkylineDatabaseConfig(), {
            host: 'mysql.example',
            username: 'skyline',
            password: 'secret',
            database: 'chat_web_skyline',
            port: '3307',
            charset: 'utf8mb4',
            timezone: '+08:00'
        })
    } finally {
        restoreEnvironment()
    }
})

test('没有直接覆盖时应从 Nacos 读取数据库节点', async () => {
    restoreEnvironment()
    delete process.env.SKYLINE_MYSQL_HOST
    delete process.env.SKYLINE_MYSQL_USERNAME
    delete process.env.SKYLINE_MYSQL_PASSWORD
    delete process.env.SKYLINE_MYSQL_DATABASE
    process.env.NACOS_SERVER = 'http://nacos.example:8848'
    process.env.NACOS_CONFIG_DATA_ID = 'chat-web-skyline-service.yaml'
    process.env.NACOS_NAMESPACE = 'namespace-id'
    process.env.NACOS_USERNAME = 'nacos'
    process.env.NACOS_PASSWORD = 'nacos-password'
    const calls = []
    global.fetch = async (url, init) => {
        calls.push({ url: String(url), init })
        if (String(url).includes('/nacos/v1/auth/login')) {
            return {
                ok: true,
                status: 200,
                async json() {
                    return { accessToken: 'access-token' }
                }
            }
        }
        return {
            ok: true,
            status: 200,
            async text() {
                return [
                    'database:',
                    '  chat-web-skyline:',
                    '    host: mysql.example',
                    '    port: 3306',
                    '    username: skyline',
                    '    password: secret',
                    '    database: chat_web_skyline'
                ].join('\n')
            }
        }
    }
    try {
        assert.deepEqual(await loadSkylineDatabaseConfig(), {
            host: 'mysql.example',
            port: 3306,
            username: 'skyline',
            password: 'secret',
            database: 'chat_web_skyline'
        })
        assert.equal(calls.length, 2)
        assert.match(calls[1].url, /\/nacos\/v1\/cs\/configs\?/)
        assert.match(calls[1].url, /accessToken=access-token/)
    } finally {
        restoreEnvironment()
    }
})

test('缺少 Nacos 启动参数或数据库节点时应抛出明确异常', async () => {
    restoreEnvironment()
    delete process.env.NACOS_SERVER
    delete process.env.SKYLINE_MYSQL_HOST
    delete process.env.SKYLINE_MYSQL_USERNAME
    delete process.env.SKYLINE_MYSQL_PASSWORD
    delete process.env.SKYLINE_MYSQL_DATABASE
    try {
        await assert.rejects(() => loadSkylineDatabaseConfig(), /缺少环境变量：NACOS_SERVER/)
        process.env.NACOS_SERVER = 'nacos.example:8848'
        process.env.NACOS_CONFIG_DATA_ID = 'chat-web-skyline-service.yaml'
        global.fetch = async () => ({
            ok: true,
            status: 200,
            async text() {
                return 'server: {}'
            }
        })
        await assert.rejects(() => loadSkylineDatabaseConfig(), /缺少 Nacos 数据库配置节点：database.chat-web-skyline/)
    } finally {
        restoreEnvironment()
    }
})
