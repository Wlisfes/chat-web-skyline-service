const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const projectRoot = join(__dirname, '..')
const declarationsPath = join(projectRoot, 'web/@types/naive-ui-auto-imports.d.ts')
const componentNames = Object.keys(require('naive-ui'))
    .filter(name => /^N[A-Z]/.test(name))
    .sort()
const declarations = componentNames.map(name => `    const ${name}: (typeof import('naive-ui'))['${name}']`).join('\n')

writeFileSync(
    declarationsPath,
    `// 此文件由 scripts/generate-naive-ui-types.cjs 自动生成，请勿手动修改\nexport {}\n\ndeclare global {\n${declarations}\n}\n`,
    'utf8'
)
