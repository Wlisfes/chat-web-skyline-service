const test = require('node:test')
const assert = require('node:assert/strict')
const { AppController } = require('../dist/app.controller')
const { AppService } = require('../dist/app.service')

function createApp() {
    const messages = []
    const appService = new AppService({
        log(message) {
            messages.push(message)
        }
    })
    return { controller: new AppController(appService), messages }
}

test('欢迎信息返回 Hello World 并记录中文日志', async () => {
    const { controller, messages } = createApp()
    assert.equal(await controller.httpBaseSkylineWelcome(), 'Hello World!')
    assert.deepEqual(messages, ['正在获取欢迎信息'])
})

test('存活检查返回 UP', async () => {
    const { controller } = createApp()
    assert.deepEqual(await controller.httpBaseSkylineLiveness(), { status: 'UP' })
})
