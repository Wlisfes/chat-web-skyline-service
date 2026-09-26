const test = require('node:test')
const assert = require('node:assert/strict')
const { BadRequestException, NotFoundException, ServiceUnavailableException } = require('@nestjs/common')
const { validate } = require('class-validator')
const { DatetaskKeyDto, ListDatetaskDto } = require('../dist/modules/datetask/dto/datetask.dto')
const { CurrencyExchangeTaskService } = require('../dist/modules/datetask/currency-exchange-task.service')
const { DatetaskUtilsService } = require('../dist/modules/datetask/datetask.utils.service')
const { DatetaskLogService } = require('../dist/modules/datetask/datetask.log.service')
const { DatetaskExecutorService } = require('../dist/modules/datetask/datetask.executor.service')
const { DatetaskSchedulerService } = require('../dist/modules/datetask/datetask.scheduler.service')
const { DatetaskInitializerService } = require('../dist/modules/datetask/datetask.initializer.service')
const { DatetaskService } = require('../dist/modules/datetask/datetask.service')
const {
    CURRENCY_EXCHANGE_TASK_HANDLER,
    DATETASK_MAX_TIMER_DELAY_MS,
    DATETASK_SCHEDULER_RETRY_DELAY_MS,
    DatetaskLogStatus,
    DatetaskManageStatus,
    DatetaskStatus,
    SYSTEM_TASK_DEFINITIONS
} = require('../dist/modules/datetask/datetask.constants')
const { TbSkylineDatetaskSystemStatus } = require('@wlisfes/chat-web-base-schema/chat-web-skyline-mysql')
test('接受一至十九位数字字符串任务 ID', async () => {
    const input = Object.assign(new DatetaskKeyDto(), { taskId: '2149446185344106496' })
    assert.deepEqual(await validate(input), [])
})
test('拒绝包含字母、符号或超过十九位的任务 ID', async () => {
    for (const taskId of ['task-1', '12345678901234567890', '']) {
        const input = Object.assign(new DatetaskKeyDto(), { taskId })
        assert.ok((await validate(input)).length > 0)
    }
})

function createUtilsService() {
    const queryBuilder = {
        where() {
            return this
        },
        setLock() {
            return this
        },
        async getOne() {
            return undefined
        }
    }
    const database = {
        async builder(_model, callback) {
            return callback(queryBuilder)
        }
    }
    return { service: new DatetaskUtilsService({}, database), database, queryBuilder }
}
test('应规范五段和六段 Cron 表达式', () => {
    const { service } = createUtilsService()
    assert.equal(service.normalizeCron(' 0 8 * * * '), '0 8 * * *')
    assert.equal(service.normalizeCron('*/10 0 8 * * 1-5'), '*/10 0 8 * * 1-5')
})
test('非法 Cron 应抛出中文校验异常', () => {
    const { service } = createUtilsService()
    assert.throws(() => service.normalizeCron(''), BadRequestException)
    assert.throws(() => service.normalizeCron('* * *'), /Cron表达式必须包含5段或6段/)
    assert.throws(() => service.normalizeCron('61 0 8 * * *'), /Cron表达式第1段格式错误/)
})
test('应计算下一次触发时间并处理周末日历语义', () => {
    const { service } = createUtilsService()
    const from = new Date(2026, 8, 2, 7, 59, 59, 500)
    assert.deepEqual(service.getNextRun('0 0 8 * * *', from), new Date(2026, 8, 2, 8, 0, 0, 0))
    assert.deepEqual(service.getNextRun('0 0 8 * * *', new Date(2026, 8, 2, 8, 0, 0, 999)), new Date(2026, 8, 3, 8, 0, 0, 0))
    assert.deepEqual(service.getNextRun('0 0 8 * * 1-5', new Date(2026, 8, 5, 9, 0, 0)), new Date(2026, 8, 7, 8, 0, 0))
    assert.deepEqual(service.getNextRun('0 0 8 * * 7', new Date(2026, 8, 5, 9, 0, 0)), new Date(2026, 8, 6, 8, 0, 0))
})
test('应通过公共 DataBaseService 查找任务并在不存在时报错', async () => {
    const { service, queryBuilder } = createUtilsService()
    const task = { taskId: '1', status: TbSkylineDatetaskSystemStatus.RUNNING }
    queryBuilder.getOne = async () => task
    assert.deepEqual(await service.findRequired('1'), task)
    queryBuilder.getOne = async () => undefined
    await assert.rejects(() => service.findRequired('1'), NotFoundException)
    await assert.rejects(() => service.findRequired(''), BadRequestException)
})
test('只允许运行中或等待中的任务进入调度器', () => {
    const { service } = createUtilsService()
    assert.equal(service.isSchedulable({ cron: '0 0 8 * * *', status: TbSkylineDatetaskSystemStatus.RUNNING }), true)
    assert.equal(service.isSchedulable({ cron: '0 0 8 * * *', status: TbSkylineDatetaskSystemStatus.STOP }), false)
    assert.equal(service.isSchedulable({ cron: '', status: TbSkylineDatetaskSystemStatus.RUNNING }), false)
})
function createLogRepository() {
    const rows = []
    let keyId = 0
    const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value)
    return {
        rows,
        async insert(values) {
            rows.push({ ...values, keyId: ++keyId })
        },
        async update(where, values) {
            const targets = rows.filter(row => matches(row, where))
            targets.forEach(row => Object.assign(row, values))
            return { affected: targets.length }
        },
        async findAndCount({ where, skip, take }) {
            const filtered = rows.filter(row => matches(row, where)).sort((a, b) => b.startTime - a.startTime || b.keyId - a.keyId)
            return [filtered.slice(skip, skip + take), filtered.length]
        }
    }
}
function createLogService() {
    const repository = createLogRepository()
    return { service: new DatetaskLogService(repository), repository }
}
test('应按开始时间倒序分页并按状态过滤执行日志', async () => {
    const { service } = createLogService()
    for (let index = 0; index < 205; index += 1) {
        const executionId = service.createExecutionId('task-1')
        const startTime = new Date(Date.UTC(2026, 8, 2, 0, 0, index))
        await service.appendRunning(executionId, 'task-1', startTime, '任务一')
        await service.complete(executionId, {
            taskId: 'task-1',
            status: index % 2 ? DatetaskLogStatus.FAILED : DatetaskLogStatus.SUCCESS,
            duration: index,
            startTime,
            endTime: startTime,
            result: { message: '执行序号 ' + index }
        })
    }
    const page = await service.list({ taskId: 'task-1', page: 2, size: 10, status: DatetaskLogStatus.SUCCESS })
    assert.equal(page.total, 103)
    assert.equal(page.list.length, 10)
    assert.equal(
        page.list.every(item => item.status === DatetaskLogStatus.SUCCESS),
        true
    )
    assert.equal(
        page.list.every(item => typeof item.keyId === 'string'),
        true
    )
    assert.equal(new Set(page.list.map(item => item.keyId)).size, page.list.length)
    assert.equal(page.list[0].duration, 184)
})
test('完成日志应更新同一执行记录，占位缺失时补写完整记录', async () => {
    const { service, repository } = createLogService()
    const executionId = service.createExecutionId('task-2')
    const startTime = new Date('2026-09-02T00:00:00.000Z')
    await service.appendRunning(executionId, 'task-2', startTime, '任务二')
    const running = await service.list({ taskId: 'task-2', page: 1, size: 10 })
    assert.equal(running.list[0].keyId, executionId)
    assert.equal(running.list[0].status, DatetaskLogStatus.RUNNING)
    const record = {
        taskId: 'task-2',
        status: DatetaskLogStatus.SUCCESS,
        duration: 120,
        startTime,
        endTime: new Date('2026-09-02T00:00:00.120Z'),
        result: { count: 1 },
        taskName: '任务二'
    }
    await service.complete(executionId, record)
    const completed = await service.list({ taskId: 'task-2', page: 1, size: 10 })
    assert.equal(completed.total, 1)
    assert.equal(completed.list[0].keyId, executionId)
    assert.equal(completed.list[0].status, DatetaskLogStatus.SUCCESS)
    assert.equal(completed.list[0].duration, 120)
    await service.complete('missing-execution', record)
    assert.equal(repository.rows.length, 2)
    assert.equal(repository.rows[1].executionId, 'missing-execution')
})

function createCurrencyTaskService(config = {}) {
    const calls = []
    const logger = {
        messages: [],
        log(message) {
            this.messages.push(message)
        }
    }
    const financeFeignClient = {
        async httpBaseFinanceSyncCurrencyExchange(authorization) {
            calls.push(authorization)
            return { date: '2026-09-05', count: 28, list: [{ currency: 'USD', rate: 1, date: '2026-09-05' }] }
        }
    }
    const service = new CurrencyExchangeTaskService(
        {
            get(key) {
                return config[key]
            }
        },
        financeFeignClient,
        logger
    )
    return { service, calls, logger }
}
test('应只携带服务凭据触发 Finance 汇率同步', async () => {
    const { service, calls, logger } = createCurrencyTaskService({ 'gateway.feign.service_token': 'finance-token' })
    assert.deepEqual(await service.execute(), {
        date: '2026-09-05',
        count: 28,
        list: [{ currency: 'USD', rate: 1, date: '2026-09-05' }]
    })
    assert.deepEqual(calls, ['Bearer finance-token'])
    assert.equal(logger.messages[0], 'Finance 汇率同步触发完成：日期=2026-09-05，写入=28 条')
})
test('已带 Bearer 前缀的服务凭据不应重复拼接', async () => {
    const { service, calls } = createCurrencyTaskService({ 'gateway.feign.service_token': 'Bearer finance-token' })
    await service.execute()
    assert.deepEqual(calls, ['Bearer finance-token'])
})
test('缺少服务凭据时应在调用 Finance 前直接失败', async () => {
    const { service, calls } = createCurrencyTaskService()
    await assert.rejects(() => service.execute(), /gateway.feign.service_token/)
    assert.equal(calls.length, 0)
})

function createExecutor(currentTask) {
    const manager = {
        updates: [],
        async update(entity, where, values) {
            this.updates.push({ entity, where, values })
            return { affected: 1 }
        }
    }
    const queryRunner = {
        connectCalls: 0,
        releaseCalls: 0,
        acquired: 1,
        manager,
        async connect() {
            this.connectCalls += 1
        },
        async query(sql) {
            if (sql.includes('GET_LOCK')) return [{ acquired: this.acquired }]
            return [{ released: 1 }]
        },
        async release() {
            this.releaseCalls += 1
        }
    }
    const dataSource = {
        createQueryRunner() {
            return queryRunner
        }
    }
    const utils = {
        calls: [],
        async findRequired(taskId, transactionManager, lock) {
            this.calls.push({ taskId, transactionManager, lock })
            return currentTask
        }
    }
    const logs = new DatetaskLogService(createLogRepository())
    const currency = {
        executeCalls: 0,
        pending: undefined,
        async execute() {
            this.executeCalls += 1
            if (this.pending) return this.pending
            return { date: '2026-09-02', count: 30 }
        }
    }
    const logger = { log() {}, warn() {}, error() {} }
    const service = new DatetaskExecutorService(dataSource, utils, logs, currency, logger)
    return { service, manager, utils, logs, currency, queryRunner }
}

function runningTask(handler = CURRENCY_EXCHANGE_TASK_HANDLER) {
    return {
        taskId: '2149446185344106496',
        taskName: '汇率同步定时任务',
        handler,
        status: TbSkylineDatetaskSystemStatus.RUNNING,
        type: 'system',
        cron: '0 0 8 * * *'
    }
}
test('应执行汇率处理器、更新时间并记录成功日志', async () => {
    const { service, manager, utils, logs, currency, queryRunner } = createExecutor(runningTask())
    assert.deepEqual(await service.execute('2149446185344106496'), { date: '2026-09-02', count: 30 })
    assert.equal(currency.executeCalls, 1)
    assert.equal(manager.updates[0].where.taskId, '2149446185344106496')
    assert.equal((await logs.list({ taskId: '2149446185344106496', page: 1, size: 10 })).list[0].status, DatetaskLogStatus.SUCCESS)
    assert.equal(service.isRunning('2149446185344106496'), false)
    assert.deepEqual(utils.calls[0], { taskId: '2149446185344106496', transactionManager: queryRunner.manager, lock: false })
})
test('停用任务应跳过执行且不写入日志', async () => {
    const stopped = runningTask()
    stopped.status = TbSkylineDatetaskSystemStatus.STOP
    const { service, currency, logs } = createExecutor(stopped)
    assert.deepEqual(await service.execute(stopped.taskId), { skipped: true, reason: '任务已停用' })
    assert.equal(currency.executeCalls, 0)
    assert.equal((await logs.list({ taskId: stopped.taskId, page: 1, size: 10 })).total, 0)
})
test('已完成任务应跳过执行且不写入日志', async () => {
    const finished = runningTask()
    finished.status = TbSkylineDatetaskSystemStatus.FINISH
    const { service, currency, logs } = createExecutor(finished)
    assert.deepEqual(await service.execute(finished.taskId), { skipped: true, reason: '任务已完成' })
    assert.equal(currency.executeCalls, 0)
    assert.equal((await logs.list({ taskId: finished.taskId, page: 1, size: 10 })).total, 0)
})
test('未知处理器应记录失败日志并抛出业务异常', async () => {
    const { service, logs } = createExecutor(runningTask('unknown-handler'))
    await assert.rejects(() => service.execute('2149446185344106496'), BadRequestException)
    assert.equal((await logs.list({ taskId: '2149446185344106496', page: 1, size: 10 })).list[0].status, DatetaskLogStatus.FAILED)
    assert.equal(
        (await logs.list({ taskId: '2149446185344106496', page: 1, size: 10 })).list[0].result.message,
        '未注册的任务处理器：unknown-handler'
    )
})
test('同一任务执行期间再次触发应返回跳过结果', async () => {
    const { service, currency } = createExecutor(runningTask())
    let release
    currency.pending = new Promise(resolve => {
        release = () => resolve({ date: '2026-09-02', count: 1 })
    })
    const first = service.execute('2149446185344106496')
    await Promise.resolve()
    assert.deepEqual(await service.execute('2149446185344106496'), { skipped: true, reason: '任务正在执行' })
    release()
    await first
})
test('MySQL 会话锁被其他 Pod 持有时应跳过执行', async () => {
    const { service, currency, queryRunner } = createExecutor(runningTask())
    queryRunner.acquired = 0
    assert.deepEqual(await service.execute('2149446185344106496'), { skipped: true, reason: '任务正在其他实例执行' })
    assert.equal(currency.executeCalls, 0)
    assert.equal(queryRunner.releaseCalls, 1)
})
test('GET_LOCK 返回异常值时应报告锁调用异常并释放连接', async () => {
    for (const acquired of [null, undefined, '', 'invalid', 2, Number.NaN]) {
        const { service, currency, queryRunner } = createExecutor(runningTask())
        queryRunner.acquired = acquired
        await assert.rejects(() => service.execute('2149446185344106496'), ServiceUnavailableException)
        assert.equal(currency.executeCalls, 0)
        assert.equal(queryRunner.releaseCalls, 1)
    }
})

function createDatetaskService() {
    const baseTask = {
        keyId: 1,
        taskId: '2149446185344106496',
        taskName: '汇率同步定时任务',
        handler: 'datetask-sync-exchange-rate',
        comment: '说明',
        cron: '0 0 8 * * *',
        type: 'system',
        status: TbSkylineDatetaskSystemStatus.RUNNING,
        body: { base: 'USD' }
    }
    const queryBuilder = {
        andWheres: [],
        skips: [],
        takes: [],
        andWhere(sql, parameters) {
            this.andWheres.push({ sql, parameters })
            return this
        },
        orderBy() {
            return this
        },
        addOrderBy() {
            return this
        },
        skip(value) {
            this.skips.push(value)
            return this
        },
        take(value) {
            this.takes.push(value)
            return this
        },
        async getManyAndCount() {
            return [[baseTask], 1]
        }
    }
    const manager = {
        updates: [],
        async update(entity, where, values) {
            this.updates.push({ entity, where, values })
            return { affected: 1 }
        }
    }
    const repository = {
        transactionCalls: 0,
        manager: {
            async transaction(callback) {
                repository.transactionCalls += 1
                return callback(manager)
            }
        }
    }
    const database = {
        async builder(_model, callback) {
            return callback(queryBuilder)
        }
    }
    const utils = {
        current: baseTask,
        normalizeCalls: [],
        async findRequired() {
            return this.current
        },
        toResponse(task) {
            return { ...task, response: true }
        },
        normalizeCron(value) {
            this.normalizeCalls.push(value)
            return value.trim()
        },
        isSchedulable() {
            return true
        }
    }
    const scheduler = {
        schedules: [],
        unschedules: [],
        schedule(id) {
            this.schedules.push(id)
        },
        unschedule(id) {
            this.unschedules.push(id)
        }
    }
    const executor = {
        ids: [],
        async execute(id) {
            this.ids.push(id)
            return { count: 30 }
        }
    }
    const logs = {
        inputs: [],
        list(input) {
            this.inputs.push(input)
            return { page: 1, size: 10, total: 0, list: [] }
        }
    }
    const service = new DatetaskService(repository, database, utils, scheduler, executor, logs)
    return { service, queryBuilder, repository, manager, utils, scheduler, executor, logs, baseTask }
}
test('应返回系统任务静态枚举', async () => {
    const { service } = createDatetaskService()
    const result = await service.httpBaseSkylineDatetaskEnums()
    assert.deepEqual(
        result.typeOptions.map(item => item.value),
        ['cron', 'manual', 'system']
    )
    assert.deepEqual(
        result.statusOptions.map(item => item.value),
        ['stop', 'wait', 'running', 'finish']
    )
    assert.deepEqual(
        result.manageStatusOptions.map(item => item.value),
        ['stop', 'running']
    )
    assert.deepEqual(
        result.logStatusOptions.map(item => item.value),
        ['running', 'success', 'failed']
    )
})

test('任务分页查询必须传入合法任务类型', async () => {
    const missing = await validate(Object.assign(new ListDatetaskDto(), { page: 1, size: 10 }))
    assert.equal(
        missing.some(error => error.property === 'type'),
        true
    )
    const invalid = await validate(Object.assign(new ListDatetaskDto(), { page: 1, size: 10, type: 'unknown' }))
    assert.equal(
        invalid.some(error => error.property === 'type'),
        true
    )
    const valid = await validate(Object.assign(new ListDatetaskDto(), { page: 1, size: 10, type: 'system' }))
    assert.equal(
        valid.some(error => error.property === 'type'),
        false
    )
})

test('应使用统一 QueryBuilder 返回任务分页数据', async () => {
    const { service, queryBuilder, baseTask } = createDatetaskService()
    assert.deepEqual(await service.httpBaseSkylineColumnDatetask({ page: 2, size: 10, type: 'system', taskName: '汇率' }), {
        page: 2,
        size: 10,
        total: 1,
        list: [{ ...baseTask, response: true }]
    })
    assert.deepEqual(queryBuilder.andWheres[0], { sql: 't.type = :type', parameters: { type: 'system' } })
    assert.deepEqual(queryBuilder.andWheres[1], { sql: 't.taskName LIKE :taskName', parameters: { taskName: '%汇率%' } })
    assert.deepEqual(queryBuilder.skips, [10])
    assert.deepEqual(queryBuilder.takes, [10])
})
test('非法任务状态应拒绝更新', async () => {
    const { service, repository } = createDatetaskService()
    await assert.rejects(
        () => service.httpBaseSkylineUpdateDatetaskStatus({ taskId: '2149446185344106496', status: TbSkylineDatetaskSystemStatus.FINISH }),
        BadRequestException
    )
    assert.equal(repository.transactionCalls, 0)
})
test('启停任务应在事务后同步调度器', async () => {
    const { service, manager, scheduler } = createDatetaskService()
    await service.httpBaseSkylineUpdateDatetaskStatus({ taskId: '2149446185344106496', status: DatetaskManageStatus.STOP })
    assert.deepEqual(manager.updates[0].values, { status: DatetaskStatus.STOP })
    assert.deepEqual(scheduler.unschedules, ['2149446185344106496'])
    await service.httpBaseSkylineUpdateDatetaskStatus({ taskId: '2149446185344106496', status: DatetaskManageStatus.RUNNING })
    assert.deepEqual(scheduler.schedules, ['2149446185344106496'])
})
test('已完成任务不可通过状态接口修改', async () => {
    const { service, manager, scheduler, utils, repository } = createDatetaskService()
    utils.current = { ...utils.current, status: TbSkylineDatetaskSystemStatus.FINISH }
    await assert.rejects(
        () => service.httpBaseSkylineUpdateDatetaskStatus({ taskId: '2149446185344106496', status: DatetaskManageStatus.STOP }),
        /已完成任务不可修改/
    )
    assert.equal(manager.updates.length, 0)
    assert.equal(scheduler.unschedules.length, 0)
    assert.equal(repository.transactionCalls, 1)
})
test('已完成任务不可通过 Cron 接口修改', async () => {
    const { service, manager, scheduler, utils } = createDatetaskService()
    utils.current = { ...utils.current, status: TbSkylineDatetaskSystemStatus.FINISH }
    await assert.rejects(
        () => service.httpBaseSkylineUpdateDatetaskCron({ taskId: '2149446185344106496', cron: '0 1 8 * * *' }),
        /已完成任务不可修改/
    )
    assert.equal(manager.updates.length, 0)
    assert.equal(scheduler.schedules.length, 0)
})
test('修改 Cron、手动触发和日志查询应委托对应组件', async () => {
    const { service, manager, scheduler, executor, logs, utils } = createDatetaskService()
    await service.httpBaseSkylineUpdateDatetaskCron({ taskId: '2149446185344106496', cron: '0 1 8 * * *' })
    assert.deepEqual(utils.normalizeCalls, ['0 1 8 * * *'])
    assert.deepEqual(manager.updates[0].values, { cron: '0 1 8 * * *' })
    assert.deepEqual(scheduler.schedules, ['2149446185344106496'])
    assert.deepEqual(await service.httpBaseSkylineTriggerDatetask({ taskId: '2149446185344106496' }), {
        success: true,
        result: { count: 30 }
    })
    assert.deepEqual(executor.ids, ['2149446185344106496'])
    const input = { taskId: '2149446185344106496', page: 1, size: 10, status: DatetaskLogStatus.SUCCESS }
    assert.deepEqual(await service.httpBaseSkylineColumnDatetaskLog(input), { page: 1, size: 10, total: 0, list: [] })
    assert.deepEqual(logs.inputs, [input])
})
test('应同步已有内置任务的系统元数据并保留人工调度配置', async () => {
    const definition = SYSTEM_TASK_DEFINITIONS[0]
    const existing = {
        ...definition,
        comment: '每天从 Frankfurter 获取汇率并通过 Finance 服务写入数据库',
        body: { base: 'USD' },
        cron: '0 30 9 * * *',
        status: 'stop',
        lastTime: new Date('2026-09-06T12:00:00.000Z')
    }
    const repository = {
        async findOne() {
            return existing
        },
        merge(target, values) {
            return Object.assign(target, values)
        },
        async save(value) {
            return value
        }
    }
    const scheduler = {
        refreshCalls: [],
        async refresh(strict) {
            this.refreshCalls.push(strict)
        }
    }
    const service = new DatetaskInitializerService(repository, scheduler, { log() {} })
    await service.onModuleInit()
    assert.equal(existing.taskName, definition.taskName)
    assert.equal(existing.handler, definition.handler)
    assert.equal(existing.comment, definition.comment)
    assert.deepEqual(existing.body, {})
    assert.equal(existing.cron, '0 30 9 * * *')
    assert.equal(existing.status, 'stop')
    assert.deepEqual(existing.lastTime, new Date('2026-09-06T12:00:00.000Z'))
    assert.deepEqual(scheduler.refreshCalls, [true])
})
test('内置任务元数据未变化时不应产生无意义写入', async () => {
    const definition = SYSTEM_TASK_DEFINITIONS[0]
    const calls = { merge: 0, save: 0 }
    const repository = {
        async findOne() {
            return { ...definition, body: {} }
        },
        merge() {
            calls.merge += 1
        },
        async save() {
            calls.save += 1
        }
    }
    const scheduler = {
        refreshCalls: [],
        async refresh(strict) {
            this.refreshCalls.push(strict)
        }
    }
    const service = new DatetaskInitializerService(repository, scheduler, { log() {} })
    await service.onModuleInit()
    assert.equal(calls.merge, 0)
    assert.equal(calls.save, 0)
    assert.deepEqual(scheduler.refreshCalls, [true])
})

function createScheduler() {
    const task = {
        taskId: 'task-1',
        taskName: '测试任务',
        cron: '0 0 8 * * *',
        status: TbSkylineDatetaskSystemStatus.RUNNING
    }
    const repository = {
        findImpl: undefined,
        findOneImpl: undefined,
        async find() {
            return this.findImpl ? this.findImpl() : []
        },
        async findOne() {
            return this.findOneImpl ? this.findOneImpl() : undefined
        },
        async update() {
            return { affected: 1 }
        }
    }
    const utils = {
        isSchedulable() {
            return true
        },
        nextRun: new Date(Date.now() + 60_000),
        getNextRun() {
            return this.nextRun
        }
    }
    const executor = {
        executeCalls: 0,
        async execute() {
            this.executeCalls += 1
        }
    }
    const logger = { log() {}, warn() {}, error() {} }
    const service = new DatetaskSchedulerService(repository, utils, executor, logger)
    return { service, task, repository, utils, executor }
}

function destroyScheduler(service) {
    service.onModuleDestroy()
}

async function flushPromises() {
    for (let index = 0; index < 8; index += 1) await Promise.resolve()
}

test('取消任务后不应让旧的异步查询重新注册定时器', async () => {
    const { service, task, repository } = createScheduler()
    try {
        let resolveTask
        repository.findOneImpl = () =>
            new Promise(resolve => {
                resolveTask = resolve
            })
        service.schedule(task.taskId)
        service.unschedule(task.taskId)
        resolveTask(task)
        await flushPromises()
        assert.equal(service.timers.size, 0)
    } finally {
        destroyScheduler(service)
    }
})

test('重新调度后旧查询不能覆盖新定时器', async () => {
    const { service, task, repository } = createScheduler()
    try {
        let resolveOld
        let calls = 0
        repository.findOneImpl = () => {
            calls += 1
            if (calls === 1)
                return new Promise(resolve => {
                    resolveOld = resolve
                })
            return Promise.resolve(task)
        }
        service.schedule(task.taskId)
        service.schedule(task.taskId)
        await flushPromises()
        assert.equal(service.timers.size, 1)
        resolveOld(task)
        await flushPromises()
        assert.equal(service.timers.size, 1)
    } finally {
        destroyScheduler(service)
    }
})

test('数据库中的非法 Cron 不应产生未处理 Promise 拒绝', async () => {
    const { service, task, repository, utils } = createScheduler()
    try {
        repository.findOneImpl = async () => task
        utils.getNextRun = () => {
            throw new Error('Cron表达式格式错误')
        }
        service.schedule(task.taskId)
        await flushPromises()
        assert.equal(service.timers.size, 0)
    } finally {
        destroyScheduler(service)
    }
})

test('超过 Node 最大延时的任务只应重新计算且不能提前执行', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
    const { service, task, repository, utils, executor } = createScheduler()
    try {
        t.mock.timers.setTime(new Date('2026-09-03T00:00:00.000Z').getTime())
        repository.findOneImpl = async () => task
        utils.getNextRun = () => new Date(Date.now() + DATETASK_MAX_TIMER_DELAY_MS + 60_000)
        service.schedule(task.taskId)
        await flushPromises()
        assert.equal(service.timers.size, 1)
        t.mock.timers.tick(DATETASK_MAX_TIMER_DELAY_MS)
        await flushPromises()
        assert.equal(executor.executeCalls, 0)
        assert.equal(service.timers.size, 1)
    } finally {
        destroyScheduler(service)
    }
})

test('严格刷新时数据库读取失败应向上抛出', async () => {
    const { service, repository } = createScheduler()
    try {
        repository.findImpl = async () => {
            throw new Error('数据库暂不可用')
        }
        await assert.rejects(() => service.refresh(true), /数据库暂不可用/)
        assert.equal(service.timers.size, 0)
    } finally {
        destroyScheduler(service)
    }
})

test('运行期间刷新读取失败应保留旧任务定时器并在恢复后替换调度', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const { service, task, repository } = createScheduler()
    try {
        repository.findOneImpl = async () => task
        service.schedule(task.taskId)
        await flushPromises()
        const oldTimer = service.timers.get(task.taskId)
        assert.ok(oldTimer)
        let findCalls = 0
        repository.findImpl = async () => {
            findCalls += 1
            if (findCalls === 1) throw new Error('数据库暂不可用')
            return [task]
        }
        await service.refresh()
        assert.equal(service.timers.get(task.taskId), oldTimer)
        t.mock.timers.tick(DATETASK_SCHEDULER_RETRY_DELAY_MS)
        await flushPromises()
        assert.equal(findCalls, 2)
        assert.notEqual(service.timers.get(task.taskId), oldTimer)
    } finally {
        destroyScheduler(service)
    }
})

test('较早的刷新结果不应覆盖较新的刷新结果', async () => {
    const { service, task, repository } = createScheduler()
    try {
        let resolveOld
        let findCalls = 0
        repository.findImpl = () => {
            findCalls += 1
            if (findCalls === 1)
                return new Promise(resolve => {
                    resolveOld = resolve
                })
            return Promise.resolve([])
        }
        const oldRefresh = service.refresh()
        await service.refresh()
        resolveOld([task])
        await Promise.all([oldRefresh, flushPromises()])
        assert.equal(service.timers.size, 0)
    } finally {
        destroyScheduler(service)
    }
})

test('运行期间读取任务失败后应延迟重试并恢复下一次调度', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const { service, task, repository } = createScheduler()
    try {
        let calls = 0
        repository.findOneImpl = async () => {
            calls += 1
            if (calls === 1) throw new Error('数据库暂不可用')
            return task
        }
        service.schedule(task.taskId)
        await flushPromises()
        assert.equal(calls, 1)
        assert.equal(service.timers.size, 1)
        t.mock.timers.tick(DATETASK_SCHEDULER_RETRY_DELAY_MS)
        await flushPromises()
        assert.equal(calls, 2)
        assert.equal(service.timers.size, 1)
    } finally {
        destroyScheduler(service)
    }
})

test('停用任务后不应执行旧的数据库重试', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const { service, task, repository } = createScheduler()
    try {
        let calls = 0
        repository.findOneImpl = async () => {
            calls += 1
            throw new Error('数据库暂不可用')
        }
        service.schedule(task.taskId)
        await flushPromises()
        assert.equal(service.timers.size, 1)
        service.unschedule(task.taskId)
        t.mock.timers.tick(DATETASK_SCHEDULER_RETRY_DELAY_MS)
        await flushPromises()
        assert.equal(calls, 1)
        assert.equal(service.timers.size, 0)
    } finally {
        destroyScheduler(service)
    }
})
