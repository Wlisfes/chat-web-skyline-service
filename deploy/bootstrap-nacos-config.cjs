'use strict'

/**
 * Skyline 部署前 Nacos 配置校准。
 *
 * 该脚本只会读取并合并已经存在的配置，不会创建数据库、数据库账号或服务凭据。
 * 这样可以避免把部署机上的真实密码/Token 写入仓库或在首次部署时生成不可追踪的凭据。
 */

const DEFAULT_SERVER_PORT = 5040
const DEFAULT_FINANCE_SERVICE_URL = 'http://chat-web-finance-service:5030'
const DEFAULT_FINANCE_SERVICE_TIMEOUT_MS = 5000
const DEFAULT_SKYLINE_FRANKFURTER_URL = 'https://api.frankfurter.dev/v2/rates'
const DEFAULT_FRANKFURTER_TIMEOUT_MS = 10_000

function required(name, environment = process.env, trim = true) {
    const raw = environment[name]
    if (typeof raw !== 'string' || raw.length === 0 || (trim && !raw.trim())) {
        throw new Error(`缺少环境变量：${name}`)
    }
    return trim ? raw.trim() : raw
}

function getBaseUrl(environment = process.env) {
    const server = required('NACOS_SERVER', environment)
    return (/^https?:\/\//i.test(server) ? server : `http://${server}`).replace(/\/$/, '')
}

async function getNacosAccessToken(environment = process.env) {
    const username = environment.NACOS_USERNAME?.trim()
    const password = environment.NACOS_PASSWORD
    if (!username || password === undefined) return undefined

    const response = await fetch(`${getBaseUrl(environment)}/nacos/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password })
    })
    if (!response.ok) throw new Error(`Nacos 鉴权失败：HTTP ${response.status}`)
    const result = await response.json()
    if (typeof result.accessToken !== 'string' || !result.accessToken.trim()) {
        throw new Error('Nacos 鉴权响应缺少 accessToken')
    }
    return result.accessToken
}

async function configUrl(dataId, environment = process.env) {
    const parameters = new URLSearchParams({
        dataId,
        group: environment.NACOS_CONFIG_GROUP?.trim() || environment.NACOS_GROUP?.trim() || 'DEFAULT_GROUP',
        tenant: required('NACOS_NAMESPACE', environment)
    })
    const accessToken = await getNacosAccessToken(environment)
    if (accessToken) parameters.set('accessToken', accessToken)
    return `${getBaseUrl(environment)}/nacos/v1/cs/configs?${parameters}`
}

async function readConfig(dataId, environment = process.env) {
    const response = await fetch(await configUrl(dataId, environment))
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`读取 Skyline Nacos 配置失败：HTTP ${response.status}`)
    const content = await response.text()
    return content.trim() ? content : undefined
}

function normalizeContent(content) {
    return `${content.replace(/\r\n?/g, '\n').trim()}\n`
}

function lineIndent(line) {
    return line.match(/^\s*/)?.[0].length ?? 0
}

function rootKey(line) {
    return line.match(/^([A-Za-z0-9_.-]+):(?:\s.*)?$/)?.[1]
}

function keyLine(line) {
    return line.match(/^(\s*)([A-Za-z0-9_.-]+):(?:\s*(.*))?$/)
}

/** 找到指定顶层 YAML 节点；不尝试解析任意 YAML，避免部署容器额外安装依赖。 */
function findRootBlock(lines, name) {
    const start = lines.findIndex(line => {
        const match = keyLine(line)
        return Boolean(match && match[1].length === 0 && match[2] === name && (!match[3] || match[3].trim().startsWith('#')))
    })
    if (start < 0) return undefined
    const end = lines.findIndex((line, index) => index > start && rootKey(line) !== undefined && lineIndent(line) === 0)
    return { start, end: end < 0 ? lines.length : end, indent: lineIndent(lines[start]) }
}

/** 找到顶层节点下的直接子节点，返回原始值和位置，便于原样保留密码/Token。 */
function findChildBlock(lines, parent, name) {
    const matches = []
    for (let index = parent.start + 1; index < parent.end; index += 1) {
        const match = keyLine(lines[index])
        if (!match || match[2] !== name || match[1].length <= parent.indent) continue
        matches.push({ index, indent: match[1].length, value: match[3] ?? '' })
    }
    if (!matches.length) return undefined
    if (matches.length > 1) throw new Error(`Nacos 配置节点重复：${name}`)
    const child = matches[0]
    let end = parent.end
    for (let index = child.index + 1; index < parent.end; index += 1) {
        if (lines[index].trim() && lineIndent(lines[index]) <= child.indent && rootKey(lines[index]) === undefined) {
            end = index
            break
        }
        if (rootKey(lines[index]) !== undefined && lineIndent(lines[index]) <= child.indent) {
            end = index
            break
        }
    }
    return { ...child, end }
}

function findDirectField(lines, block, name) {
    const matches = []
    const blockIndex = block.index ?? block.start
    let childIndent
    for (let index = blockIndex + 1; index < block.end; index += 1) {
        const match = keyLine(lines[index])
        if (!match || match[1].length <= block.indent) continue
        childIndent ??= match[1].length
        if (match[1].length !== childIndent || match[2] !== name) continue
        matches.push({ index, indent: match[1].length, value: match[3] ?? '' })
    }
    if (!matches.length) return undefined
    if (matches.length > 1) throw new Error(`Nacos 配置字段重复：${name}`)
    return matches[0]
}

function scalarPresent(value) {
    const normalized = String(value ?? '').trim()
    if (!normalized || normalized === '~' || /^null$/i.test(normalized)) return false
    if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
        return normalized.slice(1, -1).trim().length > 0
    }
    return true
}

function validateDatabaseConfig(lines) {
    const database = findRootBlock(lines, 'database')
    if (!database) throw new Error('Skyline Nacos 配置缺少 database.chat-web-skyline，请先配置数据库连接')
    const skyline = findChildBlock(lines, database, 'chat-web-skyline')
    if (!skyline) throw new Error('Skyline Nacos 配置缺少 database.chat-web-skyline，请先配置数据库连接')

    for (const field of ['host', 'username', 'password']) {
        const value = findDirectField(lines, skyline, field)
        if (!value || !scalarPresent(value.value)) {
            throw new Error(`Skyline Nacos 配置缺少 database.chat-web-skyline.${field}`)
        }
    }
    const databaseName = findDirectField(lines, skyline, 'name') ?? findDirectField(lines, skyline, 'database')
    if (!databaseName || !scalarPresent(databaseName.value)) {
        throw new Error('Skyline Nacos 配置缺少 database.chat-web-skyline.name')
    }
    const port = findDirectField(lines, skyline, 'port')
    if (
        port &&
        (!scalarPresent(port.value) || !/^\d+$/.test(String(port.value).trim()) || Number(port.value) < 1 || Number(port.value) > 65535)
    ) {
        throw new Error('Skyline Nacos 配置的 database.chat-web-skyline.port 必须是 1-65535 之间的整数')
    }
}

function validateServiceToken(lines, environment = process.env) {
    const security = findRootBlock(lines, 'security')
    const serviceToken = security ? findDirectField(lines, security, 'serviceToken') : undefined
    if (serviceToken && scalarPresent(serviceToken.value)) return
    // 允许部署主机通过 env_file 临时覆盖，但不把该值回写到 Nacos，避免凭据扩散。
    if (typeof environment.FINANCE_SERVICE_TOKEN === 'string' && environment.FINANCE_SERVICE_TOKEN.trim()) return
    throw new Error('Skyline Nacos 配置缺少 security.serviceToken，请先配置 Finance 服务间凭据')
}

function ensureServerPort(lines) {
    const server = findRootBlock(lines, 'server')
    if (!server) throw new Error('Skyline Nacos 配置缺少 server 节点')
    const port = findDirectField(lines, server, 'port')
    if (port) {
        lines[port.index] = `${lines[port.index].slice(0, lines[port.index].indexOf('port:') + 'port:'.length)} ${DEFAULT_SERVER_PORT}`
        return
    }
    lines.splice(server.start + 1, 0, `${' '.repeat(server.indent + 2)}port: ${DEFAULT_SERVER_PORT}`)
}

const DEFAULT_ENTRIES = [
    {
        key: 'FINANCE_SERVICE_URL',
        value: JSON.stringify(DEFAULT_FINANCE_SERVICE_URL),
        comment: '# Finance 服务的内部 Feign 地址。'
    },
    {
        key: 'FINANCE_SERVICE_TIMEOUT_MS',
        value: String(DEFAULT_FINANCE_SERVICE_TIMEOUT_MS),
        comment: '# Finance 服务 Feign 请求超时时间（毫秒）。'
    },
    {
        key: 'SKYLINE_FRANKFURTER_URL',
        value: JSON.stringify(DEFAULT_SKYLINE_FRANKFURTER_URL),
        comment: '# Frankfurter 汇率接口地址。'
    },
    {
        key: 'FRANKFURTER_TIMEOUT_MS',
        value: String(DEFAULT_FRANKFURTER_TIMEOUT_MS),
        comment: '# Frankfurter 请求超时时间（毫秒）。'
    }
]

function appendMissingDefaults(lines) {
    const existingKeys = new Set(lines.map(rootKey).filter(Boolean))
    const missing = DEFAULT_ENTRIES.filter(entry => !existingKeys.has(entry.key))
    if (!missing.length) return
    if (lines.length && lines[lines.length - 1].trim()) lines.push('')
    for (const entry of missing) {
        lines.push(entry.comment, `${entry.key}: ${entry.value}`)
    }
}

/**
 * 校准 Skyline 配置并返回规范化文本。
 * @param {string} content Nacos 返回的 YAML 文本
 * @param {Record<string, string | undefined>} environment 部署环境变量
 * @param {{ requireServiceToken?: boolean }} options 是否强制要求服务间凭据
 */
function sanitizeSkylineConfig(content, environment = process.env, options = { requireServiceToken: true }) {
    if (typeof content !== 'string' || !content.trim()) throw new Error('Skyline Nacos 配置不能为空')
    const lines = normalizeContent(content).trimEnd().split('\n')
    ensureServerPort(lines)
    validateDatabaseConfig(lines)
    if (options.requireServiceToken !== false) validateServiceToken(lines, environment)
    appendMissingDefaults(lines)
    return `${lines.join('\n').trim()}\n`
}

/** 仅用于人工准备完整配置的辅助函数；部署主流程不会在缺失配置时调用。 */
function createSkylineConfig(environment = process.env) {
    const scalar = value => JSON.stringify(value)
    const database = required('SKYLINE_MYSQL_DATABASE', environment)
    const host = required('SKYLINE_MYSQL_HOST', environment)
    const username = required('SKYLINE_MYSQL_USERNAME', environment)
    const password = required('SKYLINE_MYSQL_PASSWORD', environment, false)
    const token = required('FINANCE_SERVICE_TOKEN', environment, false)
    const port = Number(environment.SKYLINE_MYSQL_PORT || 3306)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SKYLINE_MYSQL_PORT 必须是 1-65535 之间的整数')
    return `server:
  port: ${DEFAULT_SERVER_PORT}
database:
  chat-web-skyline:
    host: ${scalar(host)}
    port: ${port}
    name: ${scalar(database)}
    username: ${scalar(username)}
    password: ${scalar(password)}
security:
  serviceToken: ${scalar(token)}

${DEFAULT_ENTRIES.map(entry => `${entry.comment}\n${entry.key}: ${entry.value}`).join('\n')}
`
}

async function publishConfig(dataId, content, environment = process.env) {
    const body = new URLSearchParams({
        dataId,
        group: environment.NACOS_CONFIG_GROUP?.trim() || environment.NACOS_GROUP?.trim() || 'DEFAULT_GROUP',
        tenant: required('NACOS_NAMESPACE', environment),
        type: 'yaml',
        content
    })
    const accessToken = await getNacosAccessToken(environment)
    if (accessToken) body.set('accessToken', accessToken)
    const response = await fetch(`${getBaseUrl(environment)}/nacos/v1/cs/configs`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body
    })
    const result = await response.text()
    if (!response.ok || result.trim() !== 'true') {
        throw new Error(`发布 Skyline Nacos 配置失败：HTTP ${response.status}`)
    }
}

async function main() {
    const dataId = required('NACOS_CONFIG_DATA_ID')
    const existing = await readConfig(dataId)
    if (!existing) {
        throw new Error(`未找到 Skyline Nacos 配置：${dataId}；请先创建 server、database.chat-web-skyline 和 security.serviceToken`)
    }
    const sanitized = sanitizeSkylineConfig(existing, process.env, { requireServiceToken: true })
    const normalizedExisting = normalizeContent(existing)
    if (sanitized !== normalizedExisting) {
        await publishConfig(dataId, sanitized)
        process.stdout.write(`Skyline Nacos 配置已校准：${dataId}\n`)
        return
    }
    process.stdout.write(`Skyline Nacos 配置无需变更：${dataId}\n`)
}

if (require.main === module) {
    main().catch(error => {
        // 不输出配置正文，避免数据库密码或 serviceToken 出现在 Runner 日志。
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
}

module.exports = {
    DEFAULT_SERVER_PORT,
    DEFAULT_FINANCE_SERVICE_URL,
    DEFAULT_FINANCE_SERVICE_TIMEOUT_MS,
    DEFAULT_SKYLINE_FRANKFURTER_URL,
    DEFAULT_FRANKFURTER_TIMEOUT_MS,
    createSkylineConfig,
    sanitizeSkylineConfig,
    validateDatabaseConfig,
    validateServiceToken
}
