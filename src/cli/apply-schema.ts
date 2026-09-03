import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { assertMysqlDatabaseIsolation } from '@wlisfes/chat-web-base-schema/database'
import mysql, { RowDataPacket } from 'mysql2/promise'
import { getDatabaseName, loadLocalEnvironment, loadSkylineDatabaseConfig } from '@/cli/database-config'

type MigrationRow = RowDataPacket & { checksum: string }
type IndexRow = RowDataPacket & {
    indexName: string
    nonUnique: number
    columnCount: number
    hasTaskId: number
}
type LockRow = RowDataPacket & { acquired?: number | string | null }
const MIGRATION_TABLE = 'tb_skyline_schema_migration'
export const SCHEMA_MIGRATION_LOCK_NAME = 'chat-web-skyline:schema-migration'
const TASK_ID_UNIQUE_MIGRATION = '20260902230000__tb_skyline_datetask_system__task_id_unique.sql'

/** 找到公共包中随版本发布的 Skyline 增量 SQL。 */
function changesDirectory(): string {
    const schemaEntry = createRequire(__filename).resolve('@wlisfes/chat-web-base-schema/chat-web-skyline-mysql')
    return path.join(path.resolve(path.dirname(schemaEntry), '../../../..'), 'src/schema/chat-web-skyline-mysql/sql/changes')
}

/** 确保系统任务编号存在单列唯一索引，兼容已执行最新建表 SQL 的数据库。 */
export async function ensureTaskIdUniqueIndex(connection: mysql.Connection): Promise<boolean> {
    const [rows] = await connection.query<IndexRow[]>(
        `SELECT INDEX_NAME AS indexName,
                NON_UNIQUE AS nonUnique,
                COUNT(*) AS columnCount,
                MAX(CASE WHEN COLUMN_NAME = 'task_id' THEN 1 ELSE 0 END) AS hasTaskId
           FROM information_schema.statistics
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'tb_skyline_datetask_system'
          GROUP BY INDEX_NAME, NON_UNIQUE`
    )
    const taskIdIndexes = rows.filter(row => Number(row.columnCount) === 1 && Number(row.hasTaskId) === 1)
    const uniqueIndex = taskIdIndexes.find(row => Number(row.nonUnique) === 0)
    if (uniqueIndex) return false
    const legacyIndex = taskIdIndexes.find(row => row.indexName === 'idx_tb_skyline_datetask_system_task_id')
    if (legacyIndex) {
        await connection.query(
            `ALTER TABLE \`tb_skyline_datetask_system\`
                DROP INDEX \`idx_tb_skyline_datetask_system_task_id\`,
                ADD UNIQUE KEY \`uk_tb_skyline_datetask_system_task_id\` (\`task_id\`)`
        )
        return true
    }
    await connection.query('ALTER TABLE `tb_skyline_datetask_system` ADD UNIQUE KEY `uk_tb_skyline_datetask_system_task_id` (`task_id`)')
    return true
}

/** 获取跨进程 Schema 迁移锁，避免多个发布任务同时执行 DDL 和写入迁移台账。 */
export async function acquireSchemaMigrationLock(connection: mysql.Connection): Promise<void> {
    const [rows] = await connection.query<LockRow[]>('SELECT GET_LOCK(?, 30) AS acquired', [SCHEMA_MIGRATION_LOCK_NAME])
    if (Number(rows[0]?.acquired) !== 1) {
        throw new Error('获取 Skyline Schema 迁移锁超时，请稍后重试')
    }
}

/** 释放跨进程 Schema 迁移锁。 */
export async function releaseSchemaMigrationLock(connection: mysql.Connection): Promise<void> {
    await connection.query('SELECT RELEASE_LOCK(?)', [SCHEMA_MIGRATION_LOCK_NAME])
}

/** 按文件名顺序幂等执行 Skyline 数据库增量 SQL。 */
export async function applySchema(): Promise<void> {
    loadLocalEnvironment()
    const config = await loadSkylineDatabaseConfig()
    const database = getDatabaseName(config)
    const connection = await mysql.createConnection({
        host: process.env.SKYLINE_MYSQL_HOST?.trim() || config.host,
        port: Number(process.env.SKYLINE_MYSQL_PORT || config.port || 3306),
        user: process.env.SKYLINE_MYSQL_USERNAME?.trim() || config.username,
        password: process.env.SKYLINE_MYSQL_PASSWORD ?? config.password,
        database,
        charset: process.env.SKYLINE_MYSQL_CHARSET || config.charset || 'utf8mb4',
        multipleStatements: true
    })

    let migrationLockAcquired = false
    try {
        await acquireSchemaMigrationLock(connection)
        migrationLockAcquired = true
        const [grantRows] = await connection.query<RowDataPacket[]>('SHOW GRANTS FOR CURRENT_USER()')
        assertMysqlDatabaseIsolation(
            grantRows.flatMap(row => Object.values(row).filter((value): value is string => typeof value === 'string')),
            database
        )
        await connection.query(
            `CREATE TABLE IF NOT EXISTS \`${MIGRATION_TABLE}\` (
                \`filename\` varchar(255) NOT NULL,
                \`checksum\` char(64) NOT NULL,
                \`applied_time\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (\`filename\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Skyline Schema增量记录表'`
        )

        const directory = changesDirectory()
        const filenames = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()
        for (const filename of filenames) {
            const sql = await readFile(path.join(directory, filename), 'utf8')
            const checksum = createHash('sha256').update(sql).digest('hex')
            const [rows] = await connection.execute<MigrationRow[]>(`SELECT checksum FROM \`${MIGRATION_TABLE}\` WHERE filename = ?`, [
                filename
            ])
            if (rows.length) {
                if (rows[0].checksum !== checksum) throw new Error(`已应用增量 SQL 校验和变化：${filename}`)
                process.stdout.write(`Schema migration skipped: ${filename}\n`)
                continue
            }
            let applied = true
            if (filename === TASK_ID_UNIQUE_MIGRATION) applied = await ensureTaskIdUniqueIndex(connection)
            else await connection.query(sql)
            await connection.execute(`INSERT INTO \`${MIGRATION_TABLE}\` (filename, checksum) VALUES (?, ?)`, [filename, checksum])
            process.stdout.write(`Schema migration ${applied ? 'applied' : 'skipped (唯一索引已存在)'}: ${filename}\n`)
        }

        // 每次部署都校验一次关键唯一索引，修复台账已记录但索引被人工删除的漂移。
        await ensureTaskIdUniqueIndex(connection)
    } finally {
        if (migrationLockAcquired) {
            try {
                await releaseSchemaMigrationLock(connection)
            } catch (error) {
                process.stderr.write(`释放 Skyline Schema 迁移锁失败：${error instanceof Error ? error.message : String(error)}\n`)
            }
        }
        await connection.end()
    }
}

if (require.main === module) {
    applySchema().catch(error => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
}
