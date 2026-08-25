import { expect, test } from '@playwright/test'

test('hydrates the server-rendered Naive UI page without console errors', async ({ page }) => {
    const consoleProblems: string[] = []
    page.on('console', message => {
        if (message.type() === 'warning' || message.type() === 'error') consoleProblems.push(message.text())
    })
    page.on('pageerror', error => consoleProblems.push(error.message))

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    expect(response?.headers()['x-render-mode']).toBe('ssr')
    await expect(page.getByRole('heading', { name: '服务端渲染基础框架已就绪' })).toBeVisible()
    await expect(page.locator('head style[cssr-id]')).not.toHaveCount(0)
    await expect(page.locator('css-render-style')).toHaveCount(0)

    const counter = page.getByTestId('hydration-counter')
    await expect(counter).toContainText('Hydration 计数：0')
    await counter.click()
    await expect(counter).toContainText('Hydration 计数：1')
    expect(consoleProblems).toEqual([])
})
