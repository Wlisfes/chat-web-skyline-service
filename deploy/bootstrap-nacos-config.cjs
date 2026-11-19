'use strict'

/**
 * Skyline 部署前 Nacos 配置校准。
 *
 * 该脚本只补齐操作日志所需的 rabbitmq 节点，并从 Hooks 配置复制同一虚拟主机的连接参数；
 * 其余配置只校验不覆盖，避免部署过程改掉人工维护的数据库、网关凭据等内容。
 */

const DEFAULT_SERVER_PORT = 5040
const DEFAULT_GATEWAY_SERVICE_URL = 'http://chat-web-gateway-service:5000'
const DEFAULT_GATEWAY_SERVICE_TIMEOUT_MS = 3000
/** 操作日志队列与 Hooks 共用 /chat-sms 虚拟主机。 */
const LOGGER_RABBITMQ_VHOST = '/chat-sms'
const RABBITMQ_SOURCE_DATA_ID = 'chat-web-hooks-service.yaml'

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

async function writeConfig(dataId, content, environment = process.env) {
    const response = await fetch(await configUrl(dataId, environment), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ content })
    })
    if (!response.ok) throw new Error(`写入 Skyline Nacos 配置失败：HTTP ${response.status}`)
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

/** 操作日志入队依赖 rabbitmq 节点，虚拟主机必须与 Hooks 消费端一致。 */
function validateRabbitmqConfig(lines) {
    const rabbitmq = findRootBlock(lines, 'rabbitmq')
    if (!rabbitmq) throw new Error('Skyline Nacos 配置缺少 rabbitmq，请先配置操作日志队列连接')
    for (const field of ['host', 'username', 'password']) {
        const value = findDirectField(lines, rabbitmq, field)
        if (!value || !scalarPresent(value.value)) throw new Error(`Skyline Nacos 配置缺少 rabbitmq.${field}`)
    }
    const vhost = findDirectField(lines, rabbitmq, 'vhost')
    const value = String(vhost?.value ?? '')
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
    if (value !== LOGGER_RABBITMQ_VHOST) throw new Error(`Skyline Nacos 配置 rabbitmq.vhost 必须为 ${LOGGER_RABBITMQ_VHOST}`)
}

/** 从 Hooks 配置取出 rabbitmq 节点，保证发布端和消费端用同一套连接参数。 */
function rabbitmqBlock(source) {
    const lines = normalizeContent(source).trimEnd().split('\n')
    const block = findRootBlock(lines, 'rabbitmq')
    if (!block) return undefined
    return lines.slice(block.start, block.end).join('\n').trimEnd()
}

/** 缺少 rabbitmq 节点时补上；已有节点不覆盖。 */
function ensureRabbitmqConfig(content, source) {
    if (/^rabbitmq:/m.test(content)) return content
    const block = rabbitmqBlock(source)
    if (!block) throw new Error('来源 Nacos 配置缺少 rabbitmq，无法复制操作日志队列连接')
    return `${content.trimEnd()}\n${block}\n`
}

function validateServiceToken(lines) {
    const gateway = findRootBlock(lines, 'gateway')
    const feign = gateway ? findChildBlock(lines, gateway, 'feign') : undefined
    const feignToken = feign ? findDirectField(lines, feign, 'service_token') : undefined
    if (feignToken && scalarPresent(feignToken.value)) return
    throw new Error('Skyline Nacos 配置缺少 gateway.feign.service_token，请先配置服务间凭据')
}

function hasConfiguredServiceToken(lines) {
    const gateway = findRootBlock(lines, 'gateway')
    const feign = gateway ? findChildBlock(lines, gateway, 'feign') : undefined
    const feignToken = feign ? findDirectField(lines, feign, 'service_token') : undefined
    return Boolean(feignToken && scalarPresent(feignToken.value))
}

function validateServerPort(lines) {
    const server = findRootBlock(lines, 'server')
    if (!server) throw new Error('Skyline Nacos 配置缺少 server 节点')
    const port = findDirectField(lines, server, 'port')
    if (!port || !scalarPresent(port.value) || String(port.value).trim() !== String(DEFAULT_SERVER_PORT)) {
        throw new Error(`Skyline Nacos 配置 server.port 必须为 ${DEFAULT_SERVER_PORT}`)
    }
}

function validateFeignConfig(lines, requireServiceToken = true) {
    const gateway = findRootBlock(lines, 'gateway')
    if (!gateway) throw new Error('Skyline Nacos 配置缺少 gateway.feign')
    const feign = findChildBlock(lines, gateway, 'feign')
    if (!feign) throw new Error('Skyline Nacos 配置缺少 gateway.feign')
    if (requireServiceToken && !hasConfiguredServiceToken(lines)) {
        throw new Error('Skyline Nacos 配置缺少 gateway.feign.service_token')
    }
    const url = findDirectField(lines, feign, 'url')
    if (!url || !scalarPresent(url.value)) throw new Error('Skyline Nacos 配置缺少 gateway.feign.url')
    const normalizedUrl = String(url.value)
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
    try {
        const parsed = new URL(normalizedUrl)
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
        throw new Error('Skyline Nacos 配置 gateway.feign.url 必须使用 http:// 或 https://')
    }
    const timeout = findDirectField(lines, feign, 'timeout')
    if (!timeout || !/^\d+$/.test(String(timeout.value).trim()) || Number(timeout.value) < 100 || Number(timeout.value) > 30_000) {
        throw new Error('Skyline Nacos 配置 gateway.feign.timeout 必须是 100-30000 之间的整数')
    }
}

/** 校验网关身份上下文签名配置；密钥缺失会让所有受保护接口在启动后立即失败。 */
function validateGatewayPrincipal(lines) {
    const gateway = findRootBlock(lines, 'gateway')
    if (!gateway) throw new Error('Skyline Nacos 配置缺少 gateway.principal.secret')
    const principal = findChildBlock(lines, gateway, 'principal')
    if (!principal) throw new Error('Skyline Nacos 配置缺少 gateway.principal')
    const secret = findDirectField(lines, principal, 'secret')
    const value = secret?.value?.trim().replace(/^(['"])(.*)\1$/, '$2')
    if (!value || value.length < 32) throw new Error('Skyline Nacos 配置 gateway.principal.secret 必须至少32位')
}

/**
 * 校准 Skyline 配置并返回规范化文本。
 * @param {string} content Nacos 返回的 YAML 文本
 * @param {{ requireServiceToken?: boolean }} options 是否强制要求服务间凭据
 */
function sanitizeSkylineConfig(content, options = { requireServiceToken: true }) {
    if (typeof content !== 'string' || !content.trim()) throw new Error('Skyline Nacos 配置不能为空')
    const lines = normalizeContent(content).trimEnd().split('\n')
    validateServerPort(lines)
    validateDatabaseConfig(lines)
    validateRabbitmqConfig(lines)
    validateFeignConfig(lines, options.requireServiceToken !== false)
    validateGatewayPrincipal(lines)
    if (options.requireServiceToken !== false) validateServiceToken(lines)
    return normalizeContent(content)
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
gateway:
  feign:
    service_token: ${scalar(token)}
    url: ${scalar(environment.GATEWAY_SERVICE_URL || DEFAULT_GATEWAY_SERVICE_URL)}
    timeout: ${Number(environment.GATEWAY_SERVICE_TIMEOUT_MS || DEFAULT_GATEWAY_SERVICE_TIMEOUT_MS)}
  principal:
    secret: ${scalar(required('GATEWAY_PRINCIPAL_SECRET', environment, false))}
    maxAgeSeconds: ${Number(environment.GATEWAY_PRINCIPAL_MAX_AGE_SECONDS || 60)}
database:
  chat-web-skyline:
    host: ${scalar(host)}
    port: ${port}
    name: ${scalar(database)}
    username: ${scalar(username)}
    password: ${scalar(password)}
`
}

/** 与当前环境同后缀的 Hooks 配置：生产读 chat-web-hooks-service.yaml，开发读 -development 版本。 */
function rabbitmqSourceDataId(environment = process.env) {
    const configured = environment.NACOS_RABBITMQ_SOURCE_DATA_ID?.trim()
    if (configured) return configured
    const target = environment.NACOS_CONFIG_DATA_ID?.trim() || ''
    return `chat-web-hooks-service${target.includes('-development') ? '-development' : ''}.yaml`
}

async function main() {
    const dataId = required('NACOS_CONFIG_DATA_ID')
    const existing = await readConfig(dataId)
    if (!existing) {
        throw new Error(`未找到 Skyline Nacos 配置：${dataId}；请先创建 server、database.chat-web-skyline 和 gateway.feign`)
    }
    let content = existing
    if (!/^rabbitmq:/m.test(content)) {
        const sourceDataId = rabbitmqSourceDataId(process.env)
        const source = await readConfig(sourceDataId)
        if (!source) throw new Error(`未找到 ${sourceDataId}，无法复制 rabbitmq 配置`)
        content = ensureRabbitmqConfig(existing, source)
        await writeConfig(dataId, content)
        process.stdout.write(`Skyline Nacos 配置已补齐 rabbitmq 节点：${dataId}\n`)
    }
    const sanitized = sanitizeSkylineConfig(content, { requireServiceToken: true })
    const normalizedExisting = normalizeContent(content)
    if (sanitized !== normalizedExisting) {
        process.stdout.write(`Skyline Nacos 配置格式已规范化但未回写：${dataId}\n`)
        return
    }
    process.stdout.write(`Skyline Nacos 配置校验通过：${dataId}\n`)
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
    DEFAULT_GATEWAY_SERVICE_URL,
    DEFAULT_GATEWAY_SERVICE_TIMEOUT_MS,
    LOGGER_RABBITMQ_VHOST,
    createSkylineConfig,
    sanitizeSkylineConfig,
    validateDatabaseConfig,
    validateRabbitmqConfig,
    validateGatewayPrincipal,
    validateServiceToken,
    validateFeignConfig,
    ensureRabbitmqConfig,
    rabbitmqSourceDataId
}
