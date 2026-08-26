<script lang="tsx">
import { setup as setupCssRender } from '@css-render/vue3-ssr'
import { defineComponent, type App, type DefineComponent, type PropType } from 'vue'
import { RouterView } from 'vue-router'

const AppRouterView = RouterView as unknown as DefineComponent<{ asyncData: { value: unknown } }>

export default defineComponent({
    name: 'SkylineApp',
    props: {
        ssrApp: {
            type: Object as PropType<App>,
            required: true
        },
        asyncData: {
            type: Object as PropType<{ value: unknown }>,
            required: true
        },
        fetchData: {
            type: null as unknown as PropType<unknown>,
            default: undefined
        },
        reactiveFetchData: {
            type: null as unknown as PropType<unknown>,
            default: undefined
        },
        ctx: {
            type: null as unknown as PropType<unknown>,
            default: undefined
        },
        config: {
            type: null as unknown as PropType<unknown>,
            default: undefined
        }
    },
    setup(props) {
        const { collect } = setupCssRender(props.ssrApp)
        const CssRenderCollector = defineComponent({
            name: 'CssRenderCollector',
            setup: () => () => <css-render-style innerHTML={collect()} />
        })

        return () => (
            <>
                <AppRouterView asyncData={props.asyncData} />
                {!__isBrowser__ && <CssRenderCollector />}
            </>
        )
    }
})
</script>

<style lang="scss">
@use '@web/common.scss';
</style>
