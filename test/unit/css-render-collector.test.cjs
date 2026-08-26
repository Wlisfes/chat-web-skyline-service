const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const appPath = join(__dirname, '../../web/components/layout/App.vue')

describe('CSS Render collector', () => {
    it('creates the collector as a native element in TSX', () => {
        const app = readFileSync(appPath, 'utf8')

        assert.match(app, /const CssRenderCollector = defineComponent/)
        assert.match(app, /<CssRenderCollector\s*\/>/)
        assert.match(app, /h\(['"]css-render-style['"]/)
        assert.doesNotMatch(app, /<css-render-style\b/)
    })
})
