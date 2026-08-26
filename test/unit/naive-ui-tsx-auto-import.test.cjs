const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const projectRoot = join(__dirname, '../..')
const declarationsPath = join(projectRoot, 'web/@types/naive-ui-auto-imports.d.ts')

describe('Naive UI TSX auto import', () => {
    it('provides generated types for TSX components without manual imports', () => {
        const declarations = readFileSync(declarationsPath, 'utf8')

        for (const componentName of ['NButton', 'NConfigProvider', 'NMessageProvider']) {
            assert.match(declarations, new RegExp(`const ${componentName}: \\(typeof import\\('naive-ui'\\)\\)\\['${componentName}'\\]`))
        }
    })
})
