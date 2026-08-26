const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const tsconfig = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.json'), 'utf8'))
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

describe('Skyline path aliases', () => {
    it('maps source and web aliases to their own roots', () => {
        assert.deepEqual(tsconfig.compilerOptions.paths['@/*'], ['./src/*'])
        assert.deepEqual(tsconfig.compilerOptions.paths['@web/*'], ['./web/*'])
        assert.equal(tsconfig.compilerOptions.paths['~src/*'], undefined)
    })

    it('uses the TypeScript builder so backend aliases compile to portable relative paths', () => {
        assert.match(packageJson.scripts.dev, /ssr start -b tsc(?:\s|$)/)
        assert.match(packageJson.scripts.build, /ssr build -b tsc(?:\s|$)/)
    })
})
