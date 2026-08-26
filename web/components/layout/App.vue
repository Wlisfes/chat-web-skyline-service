<script lang="tsx">
import { defineComponent, App, PropType, Fragment, h } from 'vue'
import { Omix } from '@wlisfes/chat-web-base-schema'
import { setup } from '@css-render/vue3-ssr'
import { RouterView } from 'vue-router'

export default defineComponent({
    name: 'SkylineApp',
    components: { AppRouterView: RouterView },
    props: {
        /** Vue SSR 应用实例，用于收集并注入 Naive UI 服务端渲染样式 */
        ssrApp: { type: Object as PropType<App>, required: true },
        /** 页面与布局合并后的异步数据响应式容器 */
        asyncData: { type: Object as PropType<Omix>, required: true },
        /** 当前路由预取数据的非响应式兼容字段 */
        fetchData: { type: Object as PropType<Omix> },
        /** 路由切换后实时更新的页面与布局预取数据容器 */
        reactiveFetchData: { type: Object as PropType<Omix> },
        /** 服务端渲染期间的 HTTP 请求上下文 */
        ctx: { type: Object as PropType<Omix> },
        /** SSR 框架传入的当前运行时配置 */
        config: { type: Object as PropType<Omix> }
    },
    setup(props) {
        const { collect } = setup(props.ssrApp)

        return () => (
            <Fragment>
                <app-router-view asyncData={props.asyncData} />
                {!__isBrowser__ && h('css-render-style', { innerHTML: collect() })}
            </Fragment>
        )
    }
})
</script>

<style lang="scss">
@use '@web/styles/common.scss';
</style>
