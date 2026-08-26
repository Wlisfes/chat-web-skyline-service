const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const requiredArtifacts = [
    'dist/main.js',
    'dist/app.module.js',
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

    const appModule = readFileSync(join(root, 'dist/app.module.js'), 'utf8')
    const sourceImportPattern = /require\((['"])(?:[A-Za-z]:[\\/]|\/).*?[\\/]src[\\/].*?\1\)/i
    if (sourceImportPattern.test(appModule)) {
        throw new Error('dist/app.module.js 包含指向 src 的绝对路径，部署后无法加载 Nest 模块')
    }

    const serverBundle = readFileSync(join(root, 'build/server/Page.server.js'), 'utf8')
    if (/resolveComponent["'\]\)]*\(["']css-render-style["']/.test(serverBundle)) {
        throw new Error('Page.server.js 将 css-render-style 误编译为 Vue 组件')
    }
    if (/resolveComponent["'\]\)]*\(["']common-layout-provider["']/.test(serverBundle)) {
        throw new Error('Page.server.js 未自动导入 CommonLayoutProvider 组件')
    }

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
