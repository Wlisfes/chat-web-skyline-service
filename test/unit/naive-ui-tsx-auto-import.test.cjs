const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const projectRoot = join(__dirname, '../..')
const pagePath = join(projectRoot, 'web/pages/index/render.vue')
const declarationsPath = join(projectRoot, 'web/@types/naive-ui-auto-imports.d.ts')

describe('Naive UI TSX auto import', () => {
    it('provides generated types for TSX components without manual imports', () => {
        const page = readFileSync(pagePath, 'utf8')
        const declarations = readFileSync(declarationsPath, 'utf8')
        const componentNames = [...new Set(page.match(/\bN[A-Z][A-Za-z0-9]+(?=[\s/>])/g) ?? [])]

        assert.ok(componentNames.length > 0)
        assert.doesNotMatch(page, /from\s+['"]naive-ui['"]/)
        for (const componentName of componentNames) {
            assert.match(declarations, new RegExp(`const ${componentName}: \\(typeof import\\('naive-ui'\\)\\)\\['${componentName}'\\]`))
        }
    })
})
