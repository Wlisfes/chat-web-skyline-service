const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const projectRoot = join(__dirname, '../..')

describe('CommonLayoutProvider', () => {
    it('wraps the router once at the application root instead of every page', () => {
        const app = readFileSync(join(projectRoot, 'web/components/layout/App.vue'), 'utf8')
        const page = readFileSync(join(projectRoot, 'web/pages/index/render.vue'), 'utf8')

        assert.match(app, /<common-layout-provider>[\s\S]*<app-router-view/)
        assert.doesNotMatch(page, /common-layout-provider/)
        assert.match(page, /inheritAttrs:\s*false/)
    })
})
