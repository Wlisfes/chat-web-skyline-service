# Skyline Minimal Environment Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `.env.example` 精简为两个 Nacos 正常启动必填项，并在仓库规约中明确低风险小改动可自主执行。

**Architecture:** 用仓库级 `AGENTS.md` 固化协作授权边界；用一个无运行时依赖的 Node.js 静态测试约束 `.env.example` 的变量集合、示例值和注释。运行时代码与 Nacos 默认行为保持不变。

**Tech Stack:** Markdown、dotenv 文本、Node.js `node:test`、Yarn 1

---

### Task 1: 固化小改动自主执行规约

**Files:**

- Modify: `AGENTS.md`

- [x] **Step 1: 在仓库规约中增加自主执行边界**

在 `AGENTS.md` 末尾增加：

```markdown
## 协作与确认

- 对意图明确、范围小、低风险且可轻易回滚的改动，Codex 应自行判断并直接完成，不得要求用户逐步确认设计、计划或执行细节。
- 只有在需求存在会显著改变结果的歧义，或操作涉及破坏性变更、敏感信息、生产环境、外部系统状态、不可逆操作或明显扩大任务范围时，才向用户请求确认。
- 自主执行不降低质量要求；仍须保护用户现有改动、执行与风险相称的测试，并清楚报告实际修改和验证结果。
```

- [x] **Step 2: 检查规约没有放宽高风险操作授权**

Run: `rg -n "协作与确认|低风险|破坏性|保护用户现有改动" AGENTS.md`

Expected: 新增章节的三条规则全部可检索，且高风险操作仍要求确认。

### Task 2: 用失败测试定义最小 `.env.example`

**Files:**

- Create: `test/unit/env-example.test.cjs`
- Modify: `.env.example`

- [x] **Step 1: 写入静态约束测试**

创建 `test/unit/env-example.test.cjs`：

```javascript
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8')
const assignments = Object.fromEntries(
    envExample
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const separator = line.indexOf('=')
            return [line.slice(0, separator), line.slice(separator + 1)]
        })
)

describe('.env.example', () => {
    it('只包含 Skyline 正常连接 Nacos 所需的必填项', () => {
        assert.deepEqual(assignments, {
            NACOS_CONFIG_DATA_ID: 'chat-web-skyline-service.yaml',
            NACOS_CONFIG_GROUP: 'DEFAULT_GROUP'
        })
    })

    it('说明两个配置项的用途和必填性', () => {
        assert.match(envExample, /# Nacos 配置 Data ID；正常运行必填，必须对应已发布的配置。/)
        assert.match(envExample, /# Nacos 配置组；正常运行必填，同时作为默认服务发现分组。/)
    })
})
```

- [x] **Step 2: 运行测试并确认 RED**

Run: `node --test test/unit/env-example.test.cjs`

Expected: FAIL；变量集合断言显示当前文件仍包含 `NODE_ENV`、`PORT` 及可选 Nacos 覆盖项。

- [x] **Step 3: 写入最小 `.env.example`**

将 `.env.example` 完整内容替换为：

```dotenv
# Nacos 配置 Data ID；正常运行必填，必须对应已发布的配置。
NACOS_CONFIG_DATA_ID=chat-web-skyline-service.yaml

# Nacos 配置组；正常运行必填，同时作为默认服务发现分组。
NACOS_CONFIG_GROUP=DEFAULT_GROUP
```

- [x] **Step 4: 运行测试并确认 GREEN**

Run: `node --test test/unit/env-example.test.cjs`

Expected: PASS，2 tests、0 failures。

### Task 3: 验证并提交本任务文件

**Files:**

- Modify: `AGENTS.md`
- Modify: `.env.example`
- Create: `test/unit/env-example.test.cjs`
- Create: `docs/superpowers/plans/2026-08-26-env-example-minimal.md`

- [x] **Step 1: 运行本任务验证**

Run:

```bash
yarn prettier --check AGENTS.md test/unit/env-example.test.cjs docs/superpowers/plans/2026-08-26-env-example-minimal.md
node --test test/unit/env-example.test.cjs
yarn typecheck
yarn test:unit
yarn test:integration
```

Expected: 本任务文件格式检查、两个 `.env.example` 测试、TypeScript/Vue 类型检查、全部单元测试、生产构建和 HTTP 集成测试通过。

- [x] **Step 2: 复核全量门禁和变更范围**

Run: `yarn test`、`git status --short` 和 `git diff -- .env.example AGENTS.md test/unit/env-example.test.cjs docs/superpowers/plans/2026-08-26-env-example-minimal.md`

Expected: 若全量入口仍被既有 Prettier 问题拦截，则记录实际文件且不扩大修改范围；本任务只涉及列出的四个文件，`src/app.module.ts` 仍保留为用户的独立未提交改动。

- [x] **Step 3: 只暂存本任务文件并提交**

```bash
git add -- .env.example AGENTS.md test/unit/env-example.test.cjs docs/superpowers/plans/2026-08-26-env-example-minimal.md
git commit -m "chore: minimize skyline environment example"
```

Expected: 新提交只包含本任务文件，不包含 `src/app.module.ts`。
