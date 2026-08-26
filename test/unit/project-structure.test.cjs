const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

describe('Skyline project structure', () => {
    it('does not keep a standalone src/config directory', () => {
        assert.equal(existsSync(join(process.cwd(), 'src', 'config')), false)
    })
})
