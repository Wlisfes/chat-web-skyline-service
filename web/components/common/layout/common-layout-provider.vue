<script lang="tsx">
import { defineComponent } from 'vue'
import { dateZhCN, zhCN, lightTheme } from 'naive-ui'

export default defineComponent({
    name: 'CommonLayoutProvider',
    inheritAttrs: false,
    setup(props, { slots }) {
        return () => (
            <n-config-provider abstract inline-theme-disabled theme={lightTheme} locale={zhCN} date-locale={dateZhCN}>
                <n-loading-bar-provider>
                    <n-dialog-provider>
                        <n-notification-provider max={5}>
                            <n-message-provider>{{ default: slots.default }}</n-message-provider>
                        </n-notification-provider>
                    </n-dialog-provider>
                </n-loading-bar-provider>
            </n-config-provider>
        )
    }
})
</script>
