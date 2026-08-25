import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: false,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4020',
        trace: 'retain-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'yarn start:prod',
        url: 'http://127.0.0.1:4020/health/ready',
        reuseExistingServer: false,
        timeout: 30000,
        env: {
            PORT: '4020',
            NACOS_CONFIG_ENABLED: 'false',
            NACOS_REGISTER_ENABLED: 'false'
        }
    }
})
