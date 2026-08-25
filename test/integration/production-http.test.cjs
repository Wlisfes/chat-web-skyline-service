const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const net = require('node:net')
const { after, before, describe, it } = require('node:test')

async function freePort() {
    return await new Promise((resolve, reject) => {
        const server = net.createServer()
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            const port = typeof address === 'object' && address ? address.port : 0
            server.close(error => (error ? reject(error) : resolve(port)))
        })
    })
}

async function waitFor(url, child, output) {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`Skyline 提前退出：${output()}`)
        try {
            const response = await fetch(url)
            if (response.ok) return
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    throw new Error(`等待 Skyline 启动超时：${output()}`)
}

describe('production Skyline HTTP', () => {
    let child
    let baseUrl
    let logs = ''

    before(async () => {
        const port = await freePort()
        baseUrl = `http://127.0.0.1:${port}`
        child = spawn(process.execPath, ['dist/main.js'], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                NODE_ENV: 'production',
                PORT: String(port),
                NACOS_CONFIG_ENABLED: 'false',
                NACOS_REGISTER_ENABLED: 'false'
            },
            stdio: ['ignore', 'pipe', 'pipe']
        })
        child.stdout.on('data', chunk => {
            logs += chunk.toString()
        })
        child.stderr.on('data', chunk => {
            logs += chunk.toString()
        })
        await waitFor(`${baseUrl}/health/live`, child, () => logs)
    })

    after(async () => {
        if (child && child.exitCode === null) {
            child.kill()
            await once(child, 'exit')
        }
    })

    it('reports production SSR readiness', async () => {
        const response = await fetch(`${baseUrl}/health/ready`)
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { status: 'UP', renderer: { ready: true } })
    })

    it('serves a styled SSR page and client bundle', async () => {
        const response = await fetch(`${baseUrl}/`)
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.equal(response.headers.get('x-render-mode'), 'ssr')
        assert.match(html, /服务端渲染基础框架已就绪/)
        assert.match(html, /Hydration 计数：(?:<!--.*?-->)?0/)
        assert.match(html, /class="[^"]*n-(?:card|button)/)
        assert.match(html, /<style cssr-id=/)
        assert.match(html, /<script[^>]+src=/)
        assert.doesNotMatch(html, /css-render-style/)
    })
})
