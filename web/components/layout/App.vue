<template>
    <router-view :async-data="asyncData" />
    <css-render-style v-if="!isBrowser" v-html="collect()" />
</template>

<script lang="ts" setup>
import { setup as setupCssRender } from '@css-render/vue3-ssr'
import type { App } from 'vue'

const props = defineProps<{
    ssrApp: App
    asyncData: { value: unknown }
    fetchData?: unknown
    reactiveFetchData?: unknown
    ctx?: unknown
    config?: unknown
}>()

const { collect } = setupCssRender(props.ssrApp)
const isBrowser = __isBrowser__
</script>

<style lang="less">
@import '@web/common.less';
</style>
