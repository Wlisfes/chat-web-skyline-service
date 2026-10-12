const test = require('node:test')
const assert = require('node:assert/strict')
const { validate } = require('class-validator')
const { plainToInstance } = require('class-transformer')
const { DatetaskKeyDto, ListDatetaskDto, UpdateDatetaskStatusDto } = require('../dist/modules/datetask/dto/datetask.dto')
const { DatetaskService } = require('../dist/modules/datetask/datetask.service')
const TaskSchema = require('@wlisfes/chat-web-base-schema/chat-web-task-mysql')

const configService = { get: key => (key === 'gateway.feign.service_token' ? 'service-token' : undefined) }
const principal = { uid: '30001' }

function createService(overrides = {}) {
    const calls = []
    const taskFeignClient = new Proxy(
        {},
        {
            get: (_target, method) => async (authorization, input) => {
                calls.push([method, authorization, input])
                if (overrides[method]) return overrides[method](input)
                return { taskId: input?.taskId ?? '1', createBy: '30001', modifyBy: '0' }
            }
        }
    )
    const userService = {
        async httpBaseSkylineColumnUserResolver({ uids }) {
            calls.push(['resolveUsers', uids])
            return uids.filter(uid => uid === '30001').map(uid => ({ uid, name: '李飞', number: '1233' }))
        }
    }
    return { calls, service: new DatetaskService(taskFeignClient, userService, configService) }
}

test('接受一至十九位数字字符串任务 ID，拒绝其他格式', async () => {
    assert.deepEqual(await validate(Object.assign(new DatetaskKeyDto(), { taskId: '2149446185344106496' })), [])
    for (const taskId of ['task-1', '12345678901234567890', '']) {
        assert.ok((await validate(Object.assign(new DatetaskKeyDto(), { taskId }))).length > 0)
    }
})

test('任务状态只能设置为启用或停用', async () => {
    const valid = plainToInstance(UpdateDatetaskStatusDto, { taskId: '1', status: 'enable' })
    assert.deepEqual(await validate(valid), [])
    const invalid = plainToInstance(UpdateDatetaskStatusDto, { taskId: '1', status: 'running' })
    assert.ok((await validate(invalid)).some(error => error.property === 'status'))
})

test('任务分页查询不再要求任务类型，可按模块筛选', async () => {
    assert.deepEqual(await validate(plainToInstance(ListDatetaskDto, {})), [])
    assert.deepEqual(await validate(plainToInstance(ListDatetaskDto, { module: 'TASK_FINANCE' })), [])
    assert.ok((await validate(plainToInstance(ListDatetaskDto, { module: 'CHUNK_CRM' }))).some(error => error.property === 'module'))
})

test('枚举直接读取共享定义，不调用 Task 服务', async () => {
    const { calls, service } = createService()
    const result = await service.httpBaseSkylineDatetaskEnums()
    assert.deepEqual(result.statusOptions, TaskSchema.TbTaskCronStatusDefinition.options)
    assert.deepEqual(result.moduleOptions, TaskSchema.TbTaskCronModuleDefinition.options)
    assert.equal(calls.length, 0)
})

test('写操作使用服务间凭据调用 Task 服务并传入当前操作人', async () => {
    const { calls, service } = createService()
    await service.httpBaseSkylineDatetaskStatusUpdate(principal, { taskId: '1', status: 'disable' })
    await service.httpBaseSkylineUpdateDatetaskCron(principal, { taskId: '1', cron: '0 0 9 * * *' })
    const feignCalls = calls.filter(([method]) => method !== 'resolveUsers')
    assert.deepEqual(
        feignCalls.map(([method, authorization, input]) => [method, authorization, input]),
        [
            ['httpBaseTaskCronStatusUpdate', 'Bearer service-token', { taskId: '1', status: 'disable', operatorUid: '30001' }],
            ['httpBaseTaskUpdateCron', 'Bearer service-token', { taskId: '1', cron: '0 0 9 * * *', operatorUid: '30001' }]
        ]
    )
})

test('列表的操作人在本服务直接还原：系统账号显示为系统，账号不存在保留 uid', async () => {
    const { calls, service } = createService({
        httpBaseTaskColumnCron: () => ({
            page: 1,
            size: 50,
            total: 2,
            list: [
                { taskId: '1', createBy: '0', modifyBy: '30001' },
                { taskId: '2', createBy: '30001', modifyBy: '99999' }
            ]
        })
    })
    const result = await service.httpBaseSkylineColumnDatetask({ page: 1, size: 50 })
    assert.deepEqual(result.list[0].createByOptions, { uid: '0', name: '系统' })
    assert.deepEqual(result.list[0].modifyByOptions, { uid: '30001', name: '李飞', number: '1233' })
    assert.deepEqual(result.list[1].modifyByOptions, { uid: '99999' })
    assert.deepEqual(calls.find(([method]) => method === 'resolveUsers')[1].sort(), ['30001', '99999'])
})

test('手动触发返回执行记录 ID、是否结束和执行记录', async () => {
    const { service } = createService({
        httpBaseTaskTriggerCron: input => ({
            executionId: '2150123456789012345',
            finished: false,
            execution: { executionId: '2150123456789012345', taskId: input.taskId, status: 'running', createBy: input.operatorUid }
        })
    })
    const result = await service.httpBaseSkylineTriggerDatetask(principal, { taskId: '1' })
    assert.equal(result.executionId, '2150123456789012345')
    assert.equal(result.finished, false)
    assert.deepEqual(result.execution.createByOptions, { uid: '30001', name: '李飞', number: '1233' })
})
