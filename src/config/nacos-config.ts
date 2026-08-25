export function isNacosConfigEnabled(value: string | undefined = process.env.NACOS_CONFIG_ENABLED): boolean {
    if (value === undefined || value === '' || value === 'true') return true
    if (value === 'false') return false
    throw new Error('NACOS_CONFIG_ENABLED 必须是 true 或 false')
}
