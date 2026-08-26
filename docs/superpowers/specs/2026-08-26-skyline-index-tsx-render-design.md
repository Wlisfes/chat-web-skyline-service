# Skyline 首页 TSX 渲染重构设计

## 目标

将 `web/pages/index/render.vue` 从模板与 `<script setup>` 写法改为 `<script lang="tsx">` 和 `defineComponent` 写法，同时保持现有页面结构、样式、交互、SSR 与水合行为不变。

## 实现方式

- 保留 `render.vue` 文件名及当前路由发现约定。
- 使用 `defineComponent` 定义 `SkylineIndex` 组件，在 `setup` 中继续初始化 Pinia store、计数状态和渲染模式。
- `setup` 返回 TSX 渲染函数，使用 Naive UI 的 PascalCase 组件和 JSX 属性语法。
- 保留 `NGrid` 的 `responsive="self"`，避免重新引入服务端与客户端首屏列数不一致的问题。
- 保留 `data-testid`、中文文案、DOM 层级和点击计数行为，确保现有 E2E 用例无需修改。

## 不在范围内

- 不修改路由、store、布局组件或样式文件。
- 不改名为 `render.tsx`。
- 不升级 Vue、Naive UI 或 SSR/Webpack 工具链。

## 验证

- 对修改文件执行 Prettier 检查。
- 执行 TypeScript 类型检查和生产构建。
- 执行首页 E2E，确认 SSR、水合、样式注入、点击交互及浏览器控制台均正常。
