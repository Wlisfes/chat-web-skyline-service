import { randomBytes } from 'node:crypto'
import mysql from 'mysql2/promise'
import { applySchema } from '@/cli/apply-schema'
import { DatabaseConfig, getDatabaseName, loadLocalEnvironment, loadSkylineDatabaseConfig } from '@/cli/database-config'

const MIGRATION_USER_PREFIX = 'skyline_mig_'
const MYSQL_ACCOUNT_HOST = '%'

type MigrationCredentials = {
    username: string
    password: string
}

/** 组装已选中 Skyline 数据库的管理员连接参数，供兼容性检查和账号授权使用。 */
export function createAdminConnectionOptions(config: DatabaseConfig, database: string): mysql.ConnectionOptions {
    const host = process.env.SKYLINE_MYSQL_HOST?.trim() || config.host
    const port = Number(process.env.SKYLINE_MYSQL_PORT || config.port || 3306)

    return {
        host,
        port,
        user: process.env.SKYLINE_MYSQL_USERNAME?.trim() || config.username,
        password: process.env.SKYLINE_MYSQL_PASSWORD ?? config.password,
        database,
        charset: process.env.SKYLINE_MYSQL_CHARSET || config.charset || 'utf8mb4'
    }
}

/** 生成长度符合 MySQL 账号限制的临时迁移账号。 */
export function createMigrationCredentials(random = randomBytes(18)): MigrationCredentials {
    const suffix = random.toString('hex')
    return {
        username: `${MIGRATION_USER_PREFIX}${suffix}`.slice(0, 32),
        password: randomBytes(32).toString('base64url')
    }
}

/** 使用管理员账号创建仅能访问 Skyline 数据库的临时迁移账号。 */
export async function createMigrationUser(
    connection: mysql.Connection,
    database: string,
    credentials: MigrationCredentials
): Promise<void> {
    const account = `${mysql.escape(credentials.username)}@${mysql.escape(MYSQL_ACCOUNT_HOST)}`
    await connection.query(`CREATE USER ${account} IDENTIFIED BY ${mysql.escape(credentials.password)}`)
    await connection.query(`GRANT ALL PRIVILEGES ON ${mysql.escapeId(database)}.* TO ${account}`)
}

/** 删除临时迁移账号，避免管理员账号授权长期留存。 */
export async function dropMigrationUser(connection: mysql.Connection, credentials: MigrationCredentials): Promise<void> {
    const account = `${mysql.escape(credentials.username)}@${mysql.escape(MYSQL_ACCOUNT_HOST)}`
    await connection.query(`DROP USER IF EXISTS ${account}`)
}

/** 使用 Nacos 中的管理员连接临时授权，再以受限账号执行 Schema。 */
async function main(): Promise<void> {
    loadLocalEnvironment()
    const config = await loadSkylineDatabaseConfig()
    const database = getDatabaseName(config)
    const adminConnectionOptions = createAdminConnectionOptions(config, database)
    const adminConnection = await mysql.createConnection(adminConnectionOptions)
    const credentials = createMigrationCredentials()

    try {
        await createMigrationUser(adminConnection, database, credentials)
        const previousEnvironment = {
            host: process.env.SKYLINE_MYSQL_HOST,
            port: process.env.SKYLINE_MYSQL_PORT,
            username: process.env.SKYLINE_MYSQL_USERNAME,
            password: process.env.SKYLINE_MYSQL_PASSWORD,
            database: process.env.SKYLINE_MYSQL_DATABASE
        }
        process.env.SKYLINE_MYSQL_HOST = String(adminConnectionOptions.host)
        process.env.SKYLINE_MYSQL_PORT = String(adminConnectionOptions.port)
        process.env.SKYLINE_MYSQL_USERNAME = credentials.username
        process.env.SKYLINE_MYSQL_PASSWORD = credentials.password
        process.env.SKYLINE_MYSQL_DATABASE = database
        try {
            await applySchema()
        } finally {
            for (const [key, value] of Object.entries(previousEnvironment)) {
                if (value === undefined) delete process.env[key]
                else process.env[key] = value
            }
        }
    } finally {
        try {
            await dropMigrationUser(adminConnection, credentials)
        } finally {
            await adminConnection.end()
        }
    }
}

if (require.main === module) {
    main().catch(error => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
}
