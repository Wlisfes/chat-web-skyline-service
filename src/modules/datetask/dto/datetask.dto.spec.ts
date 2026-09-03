import { validate } from 'class-validator'
import { DatetaskKeyDto } from './datetask.dto'

describe('DatetaskKeyDto', () => {
    it('接受一至十九位数字字符串任务 ID', async () => {
        const input = Object.assign(new DatetaskKeyDto(), { taskId: '2149446185344106496' })

        await expect(validate(input)).resolves.toEqual([])
    })

    it('拒绝包含字母、符号或超过十九位的任务 ID', async () => {
        for (const taskId of ['task-1', '12345678901234567890', '']) {
            const input = Object.assign(new DatetaskKeyDto(), { taskId })
            const errors = await validate(input)
            expect(errors.length).toBeGreaterThan(0)
        }
    })
})
