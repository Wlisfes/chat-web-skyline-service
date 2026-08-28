const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

function getAuthToken() {
    if (process.env.NODE_AUTH_TOKEN) {
        return process.env.NODE_AUTH_TOKEN
    }

    const result = spawnSync('gh', ['auth', 'token'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true
    })
    const token = result.stdout?.trim()

    if (result.status !== 0 || !token) {
        throw new Error('请先执行 gh auth login，或设置 NODE_AUTH_TOKEN。')
    }

    return token
}

function runYarn(args, env) {
    const yarnCli = process.env.npm_execpath

    if (yarnCli) {
        return spawnSync(process.execPath, [yarnCli, ...args], {
            env,
            stdio: 'inherit',
            windowsHide: true
        })
    }

    return spawnSync(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', args, {
        env,
        stdio: 'inherit',
        windowsHide: true
    })
}

const args = process.argv.slice(2)
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'skyline-yarn-'))
const userConfig = path.join(tempDirectory, '.npmrc')

try {
    const token = getAuthToken()
    fs.writeFileSync(
        userConfig,
        [
            '@wlisfes:registry=https://npm.pkg.github.com',
            '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}',
            'always-auth=true',
            ''
        ].join('\n'),
        { mode: 0o600 }
    )

    const result = runYarn(args, {
        ...process.env,
        NODE_AUTH_TOKEN: token,
        NPM_CONFIG_USERCONFIG: userConfig
    })

    if (result.error) {
        throw result.error
    }

    process.exitCode = result.status ?? 1
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
} finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
}
