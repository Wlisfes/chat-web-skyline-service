const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const requiredArtifacts = [
    'dist/main.js',
    'build/server/Page.server.js',
    'build/client/asset-manifest.json',
    'build/asyncChunkMap.json'
]

function collectStrings(value) {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(collectStrings)
    if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
    return []
}

function verifyBuild(root = process.cwd()) {
    const missing = requiredArtifacts.filter(relativePath => !existsSync(join(root, relativePath)))
    if (missing.length > 0) throw new Error(`缺少构建产物：${missing.join(', ')}`)

    const manifestPath = join(root, 'build/client/asset-manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (!collectStrings(manifest).some(value => /\.js(?:\?|$)/.test(value))) {
        throw new Error('asset-manifest.json 不包含 client JavaScript 资源')
    }
}

if (require.main === module) {
    try {
        verifyBuild()
        console.log('Skyline build artifacts verified')
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    }
}

module.exports = { verifyBuild }
