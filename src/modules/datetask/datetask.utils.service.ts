import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataBaseService } from '@wlisfes/chat-web-base-schema/database'
import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { isEmpty, isNotEmpty } from 'class-validator'
import { EntityManager, Repository } from 'typeorm'
import { DatetaskStatus } from '@/modules/datetask/datetask.constants'

/** 系统任务的可读字段，避免控制器直接接触实体查询细节。 */
export type DatetaskRecord = TbSkylineDatetaskSystem & {
    taskId: string
    taskName: string
    handler: string
    comment?: string
    cron?: string
    type: string
    status: string
    body?: Record<string, unknown>
    lastTime?: Date | string
    nextTime?: Date | string
}

@Injectable()
export class DatetaskUtilsService {
    constructor(
        @InjectRepository(TbSkylineDatetaskSystem) private readonly repository: Repository<TbSkylineDatetaskSystem>,
        private readonly database: DataBaseService
    ) {}

    /** 根据任务 ID 查找任务，不存在时抛出业务异常。 */
    public async findRequired(taskId: string, manager?: EntityManager, lock = false): Promise<DatetaskRecord> {
        if (isEmpty(taskId) || typeof taskId !== 'string') {
            throw new BadRequestException('任务ID不能为空')
        }

        const repository = manager?.getRepository(TbSkylineDatetaskSystem) ?? this.repository
        const task = await this.database.builder(repository, qb => {
            qb.where('t.taskId = :taskId', { taskId })
            if (lock) qb.setLock('pessimistic_write')
            return qb.getOne()
        })
        if (!task) throw new NotFoundException('系统任务不存在')
        return task as DatetaskRecord
    }

    /** 校验并规范 Cron 表达式，支持五段和六段标准表达式。 */
    public normalizeCron(cron: string): string {
        if (typeof cron !== 'string' || !cron.trim()) {
            throw new BadRequestException('Cron表达式不能为空')
        }
        const normalized = cron.trim().replace(/\s+/g, ' ')
        const fields = normalized.split(' ')
        if (fields.length !== 5 && fields.length !== 6) {
            throw new BadRequestException('Cron表达式必须包含5段或6段')
        }
        const values = fields.length === 5 ? ['0', ...fields] : fields
        const ranges: Array<[number, number]> = [
            [0, 59],
            [0, 59],
            [0, 23],
            [1, 31],
            [1, 12],
            [0, 7]
        ]
        values.forEach((field, index) => {
            if (!this.isCronField(field, ranges[index][0], ranges[index][1])) {
                throw new BadRequestException(`Cron表达式第${index + 1}段格式错误`)
            }
        })
        return normalized
    }

    /** 计算 Cron 下一次触发时间；找不到时返回 undefined。 */
    public getNextRun(cron: string, from = new Date()): Date | undefined {
        const normalized = this.normalizeCron(cron)
        const fields = normalized.split(' ')
        const values = fields.length === 5 ? ['0', ...fields] : fields
        const seconds = this.cronValues(values[0], 0, 59)
        // 先截断毫秒，再向后移动一秒，确保候选时间不会早于调用时刻。
        // 直接对 `from + 1000ms` 截断会在毫秒大于 0 时回退到上一秒，造成重复触发。
        const candidate = new Date(from)
        candidate.setMilliseconds(0)
        candidate.setSeconds(candidate.getSeconds() + 1)
        const limit = candidate.getTime() + 366 * 24 * 60 * 60 * 1000
        while (candidate.getTime() <= limit) {
            const minuteStart = new Date(candidate)
            minuteStart.setSeconds(0, 0)
            if (
                this.matchesCronField(values[1], minuteStart.getMinutes(), 0, 59) &&
                this.matchesCronField(values[2], minuteStart.getHours(), 0, 23) &&
                this.matchesCronCalendar(values[3], minuteStart.getDate(), values[5], minuteStart.getDay()) &&
                this.matchesCronField(values[4], minuteStart.getMonth() + 1, 1, 12)
            ) {
                for (const second of seconds) {
                    const result = new Date(minuteStart)
                    result.setSeconds(second, 0)
                    if (result.getTime() >= candidate.getTime()) return result
                }
            }
            candidate.setTime(minuteStart.getTime() + 60_000)
        }
        return undefined
    }

    /** 将数据库任务转换为接口响应，保留共享实体字段。 */
    public toResponse(task: TbSkylineDatetaskSystem): DatetaskRecord {
        return { ...task } as DatetaskRecord
    }

    /** 判断任务是否允许由调度器注册。 */
    public isSchedulable(task: Pick<DatetaskRecord, 'cron' | 'status'>): boolean {
        return isNotEmpty(task.cron) && (task.status === DatetaskStatus.RUNNING || task.status === DatetaskStatus.WAIT)
    }

    private isCronField(field: string, minimum: number, maximum: number): boolean {
        if (!field) return false
        return field.split(',').every(part => {
            const [range, stepText] = part.split('/')
            if (part.split('/').length > 2) return false
            const step = stepText === undefined ? 1 : Number(stepText)
            if (!Number.isInteger(step) || step < 1) return false
            const [startText, endText] = range.split('-')
            if (range.split('-').length > 2) return false
            if (startText === '*') return endText === undefined
            const start = Number(startText)
            const end = endText === undefined ? start : Number(endText)
            return Number.isInteger(start) && Number.isInteger(end) && start >= minimum && end <= maximum && start <= end
        })
    }

    private matchesCronField(field: string, value: number, minimum: number, maximum: number): boolean {
        return this.cronValues(field, minimum, maximum).includes(value)
    }

    private cronValues(field: string, minimum: number, maximum: number): number[] {
        const values = new Set<number>()
        const addValue = (value: number): void => {
            // JavaScript 的 Date#getDay() 使用 0 表示星期日，而 Cron 同时允许 0 和 7。
            // 只在写入结果时归一化 7，不能把区间起点直接改成 0，否则单值 `7` 会被错误地扩展为 `0-7`。
            const normalized = maximum === 7 && value === 7 ? 0 : value
            if (normalized >= minimum && normalized <= maximum) values.add(normalized)
        }
        for (const part of field.split(',')) {
            const [range, stepText] = part.split('/')
            const step = stepText === undefined ? 1 : Number(stepText)
            if (range === '*') {
                for (let value = minimum; value <= maximum; value += step) addValue(value)
                continue
            }
            const [startText, endText] = range.split('-')
            const start = Number(startText)
            const end = endText === undefined ? start : Number(endText)
            for (let value = start; value <= end; value += step) {
                addValue(value)
            }
        }
        return [...values].sort((left, right) => left - right)
    }

    private matchesCronCalendar(dayOfMonthField: string, dayOfMonth: number, dayOfWeekField: string, dayOfWeek: number): boolean {
        const dayOfMonthWildcard = dayOfMonthField === '*'
        const dayOfWeekWildcard = dayOfWeekField === '*'
        const dayOfMonthMatches = this.matchesCronField(dayOfMonthField, dayOfMonth, 1, 31)
        const dayOfWeekMatches = this.matchesCronField(dayOfWeekField, dayOfWeek, 0, 7)
        if (!dayOfMonthWildcard && !dayOfWeekWildcard) return dayOfMonthMatches || dayOfWeekMatches
        return dayOfMonthMatches && dayOfWeekMatches
    }
}
