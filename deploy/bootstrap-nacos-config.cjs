'use strict'

function required(name, environment = process.env) {
    const raw = environment[name]
    if (typeof raw !== 'string' || !raw.trim()) throw new Error(`缺少环境变量：${name}`)
    return raw.trim()
}

function getBaseUrl(environment = process.env) {
    const server = required('NACOS_SERVER', environment)
    return (/^https?:\/\//i.test(server) ? server : `http://${server}`).replace(/\/$/, '')
}

function getConfigGroup(environment = process.env) {
    return environment.NACOS_CONFIG_GROUP?.trim() || environment.NACOS_GROUP?.trim() || 'DEFAULT_GROUP'
}

function configUrl(dataId, environment = process.env) {
    const parameters = new URLSearchParams({
        dataId,
        group: getConfigGroup(environment),
        tenant: environment.NACOS_NAMESPACE?.trim() || 'public'
    })
    return `${getBaseUrl(environment)}/nacos/v1/cs/configs?${parameters}`
}

async function readConfig(dataId, environment = process.env) {
    const response = await fetch(configUrl(dataId, environment))
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`读取 Nacos 配置 ${dataId} 失败：HTTP ${response.status}`)
    const content = await response.text()
    return content.trim() ? content : undefined
}

function createSkylineConfig() {
    return 'server:\n  port: 4020\n'
}

function sanitizeSkylineConfig(content) {
    if (!/^server:\s*$/m.test(content)) throw new Error('现有 Skyline Nacos 配置必须包含 server 根节点')
    return createSkylineConfig()
}

async function publishConfig(dataId, content, environment = process.env) {
    const body = new URLSearchParams({
        dataId,
        group: getConfigGroup(environment),
        tenant: environment.NACOS_NAMESPACE?.trim() || 'public',
        type: 'yaml',
        content
    })
    const response = await fetch(`${getBaseUrl(environment)}/nacos/v1/cs/configs`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body
    })
    const result = await response.text()
    if (!response.ok || result.trim() !== 'true') throw new Error(`发布 Nacos 配置 ${dataId} 失败：HTTP ${response.status}`)
}

async function main() {
    const dataId = required('NACOS_CONFIG_DATA_ID')
    const existingConfig = await readConfig(dataId)
    const sanitizedConfig = existingConfig ? sanitizeSkylineConfig(existingConfig) : createSkylineConfig()

    if (existingConfig && sanitizedConfig === `${existingConfig.trim()}\n`) {
        process.stdout.write(`Nacos 配置已符合 Skyline 边界：${dataId}\n`)
        return
    }

    await publishConfig(dataId, sanitizedConfig)
    process.stdout.write(`${existingConfig ? 'Nacos 配置已净化' : 'Nacos 配置已创建'}：${dataId}\n`)
}

if (require.main === module) {
    main().catch(error => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
}

module.exports = { createSkylineConfig, sanitizeSkylineConfig }
