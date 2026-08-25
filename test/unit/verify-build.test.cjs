const assert = require('node:assert/strict')
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { describe, it } = require('node:test')
const { verifyBuild } = require('../../scripts/verify-build.cjs')

function createRoot() {
    return mkdtempSync(join(tmpdir(), 'skyline-build-'))
}

describe('verifyBuild', () => {
    it('rejects a build missing required artifacts', () => {
        assert.throws(() => verifyBuild(createRoot()), /缺少构建产物/)
    })

    it('accepts complete artifacts with a JavaScript client entry', () => {
        const root = createRoot()
        mkdirSync(join(root, 'dist'), { recursive: true })
        mkdirSync(join(root, 'build/server'), { recursive: true })
        mkdirSync(join(root, 'build/client'), { recursive: true })
        writeFileSync(join(root, 'dist/main.js'), '')
        writeFileSync(join(root, 'build/server/Page.server.js'), '')
        writeFileSync(join(root, 'build/asyncChunkMap.json'), '{}')
        writeFileSync(
            join(root, 'build/client/asset-manifest.json'),
            JSON.stringify({ 'Page.js': '/static/Page.abc.js' })
        )

        assert.doesNotThrow(() => verifyBuild(root))
    })

    it('rejects a manifest without a client JavaScript asset', () => {
        const root = createRoot()
        mkdirSync(join(root, 'dist'), { recursive: true })
        mkdirSync(join(root, 'build/server'), { recursive: true })
        mkdirSync(join(root, 'build/client'), { recursive: true })
        writeFileSync(join(root, 'dist/main.js'), '')
        writeFileSync(join(root, 'build/server/Page.server.js'), '')
        writeFileSync(join(root, 'build/asyncChunkMap.json'), '{}')
        writeFileSync(
            join(root, 'build/client/asset-manifest.json'),
            JSON.stringify({ 'Page.css': '/static/Page.css' })
        )

        assert.throws(() => verifyBuild(root), /client JavaScript/)
    })
})
