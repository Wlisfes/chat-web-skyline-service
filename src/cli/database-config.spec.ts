import { getDatabaseName, identifier, loadSkylineDatabaseConfig } from './database-config'

describe('Skyline 数据库配置工具', () => {
    const originalEnvironment = { ...process.env }
    const originalFetch = global.fetch

    afterEach(() => {
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnvironment)) delete process.env[key]
        }
        for (const [key, value] of Object.entries(originalEnvironment)) process.env[key] = value
        global.fetch = originalFetch
        jest.restoreAllMocks()
    })

    it('应校验数据库标识符并解析数据库名称', () => {
        expect(identifier('chat_web_skyline', '数据库名称')).toBe('chat_web_skyline')
        expect(() => identifier('chat web skyline', '数据库名称')).toThrow('数据库名称只能包含字母、数字、下划线和连字符')
        expect(getDatabaseName({ host: 'localhost', username: 'chat', password: 'secret', database: 'chat_web_skyline' })).toBe(
            'chat_web_skyline'
        )
        expect(() => getDatabaseName({ host: 'localhost', username: 'chat', password: 'secret' })).toThrow('Skyline 数据库名称不能为空')
    })

    it('应优先读取 SKYLINE_MYSQL_* 直接覆盖配置', async () => {
        process.env.SKYLINE_MYSQL_HOST = 'mysql.example'
        process.env.SKYLINE_MYSQL_USERNAME = 'skyline'
        process.env.SKYLINE_MYSQL_PASSWORD = 'secret'
        process.env.SKYLINE_MYSQL_DATABASE = 'chat_web_skyline'
        process.env.SKYLINE_MYSQL_PORT = '3307'

        await expect(loadSkylineDatabaseConfig()).resolves.toEqual(
            expect.objectContaining({
                host: 'mysql.example',
                username: 'skyline',
                password: 'secret',
                database: 'chat_web_skyline',
                port: '3307'
            })
        )
    })

    it('没有直接覆盖时应从 Nacos 读取数据库节点', async () => {
        process.env.NACOS_SERVER = 'http://nacos.example:8848'
        process.env.NACOS_CONFIG_DATA_ID = 'chat-web-skyline-service.yaml'
        process.env.NACOS_NAMESPACE = 'namespace-id'
        process.env.NACOS_USERNAME = 'nacos'
        process.env.NACOS_PASSWORD = 'nacos-password'
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce({ ok: true, status: 200, json: jest.fn().mockResolvedValue({ accessToken: 'access-token' }) })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: jest
                    .fn()
                    .mockResolvedValue(
                        [
                            'database:',
                            '  chat-web-skyline:',
                            '    host: mysql.example',
                            '    port: 3306',
                            '    username: skyline',
                            '    password: secret',
                            '    database: chat_web_skyline'
                        ].join('\n')
                    )
            }) as unknown as typeof fetch

        await expect(loadSkylineDatabaseConfig()).resolves.toEqual({
            host: 'mysql.example',
            port: 3306,
            username: 'skyline',
            password: 'secret',
            database: 'chat_web_skyline'
        })
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain('/nacos/v1/cs/configs?')
        expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain('accessToken=access-token')
    })

    it('缺少 Nacos 启动参数或数据库节点时应抛出明确异常', async () => {
        delete process.env.NACOS_SERVER
        delete process.env.SKYLINE_MYSQL_HOST
        delete process.env.SKYLINE_MYSQL_USERNAME
        delete process.env.SKYLINE_MYSQL_PASSWORD
        delete process.env.SKYLINE_MYSQL_DATABASE
        await expect(loadSkylineDatabaseConfig()).rejects.toThrow('缺少环境变量：NACOS_SERVER')

        process.env.NACOS_SERVER = 'nacos.example:8848'
        process.env.NACOS_CONFIG_DATA_ID = 'chat-web-skyline-service.yaml'
        global.fetch = jest
            .fn()
            .mockResolvedValue({ ok: true, status: 200, text: jest.fn().mockResolvedValue('server: {}') }) as unknown as typeof fetch
        await expect(loadSkylineDatabaseConfig()).rejects.toThrow('缺少 Nacos 数据库配置节点：database.chat-web-skyline')
    })
})
