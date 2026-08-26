const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

describe('Skyline favicon', () => {
    it('keeps the copied manager icon and references it from the document head', () => {
        const favicon = readFileSync(join(process.cwd(), 'public/favicon.ico'))
        const layout = readFileSync(join(process.cwd(), 'web/components/layout/index.vue'), 'utf8')

        assert.deepEqual([...favicon.subarray(0, 4)], [0, 0, 1, 0])
        assert.equal(createHash('sha256').update(favicon).digest('hex'), 'e6b77d832661fe106716b920e3f9ab5a9e70e1829adafd44b57196de581963ed')
        assert.match(layout, /<link rel="icon" type="image\/x-icon" href="\/favicon\.ico" \/>/)
    })
})
