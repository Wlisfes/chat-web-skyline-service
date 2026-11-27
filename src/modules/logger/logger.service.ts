import { Injectable } from '@nestjs/common'
import { InjectRepository, DataBaseService, Repository } from '@wlisfes/chat-web-base-schema/database'
import { fetchResolver, fetchUntiePagination, isNotEmpty, PageResult } from '@wlisfes/chat-web-base-schema/utils'
import { TbSkylineLogger, TbSkylineSheet, TbSkylineSheetType } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import * as LoggerDto from '@/modules/logger/dto/logger.dto'

@Injectable()
export class SkylineLoggerService {
    constructor(
        @InjectRepository(TbSkylineLogger) private readonly loggerRepository: Repository<TbSkylineLogger>,
        @InjectRepository(TbSkylineSheet) private readonly sheetRepository: Repository<TbSkylineSheet>,
        private readonly database: DataBaseService
    ) {}

    /** 按菜单节点展开按钮权限码后分页查询。选中目录或菜单时包含全部下级按钮。 */
    public async httpBaseSkylineColumnLogger(input: LoggerDto.LoggerColumnQueryDto): Promise<PageResult<TbSkylineLogger>> {
        const { page, size } = fetchUntiePagination(input)
        const permissionCodes = await this.resolvePermissionCodes(input.sheetKeyId)
        return this.database.builder(this.loggerRepository, async qb => {
            if (permissionCodes) {
                qb.andWhere('t.permissionCode IN (:...permissionCodes)', { permissionCodes })
            }
            if (isNotEmpty(input.permissionCode?.trim())) {
                qb.andWhere('t.permissionCode = :permissionCode', { permissionCode: input.permissionCode.trim() })
            }
            if (isNotEmpty(input.operatorName?.trim())) {
                qb.andWhere('(t.operatorName LIKE :operatorName OR t.operatorNumber LIKE :operatorName)', {
                    operatorName: `%${input.operatorName.trim()}%`
                })
            }
            if (isNotEmpty(input.logId?.trim())) {
                qb.andWhere('t.logId = :logId', { logId: input.logId.trim() })
            }
            if (isNotEmpty(input.result)) {
                qb.andWhere('t.result = :result', { result: input.result })
            }
            if (isNotEmpty(input.resourceType?.trim())) {
                qb.andWhere('t.resourceType = :resourceType', { resourceType: input.resourceType.trim() })
            }
            if (isNotEmpty(input.resourceId?.trim())) {
                qb.andWhere('t.resourceId = :resourceId', { resourceId: input.resourceId.trim() })
            }
            if (isNotEmpty(input.startTime)) {
                qb.andWhere('t.createTime >= :startTime', { startTime: input.startTime })
            }
            if (isNotEmpty(input.endTime)) {
                qb.andWhere('t.createTime <= :endTime', { endTime: input.endTime })
            }
            qb.orderBy('t.createTime', 'DESC')
            qb.addOrderBy('t.keyId', 'DESC')
            qb.skip((page - 1) * size)
            qb.take(size)
            return await qb.getManyAndCount().then(async ([list, total]) => {
                return fetchResolver({ page, size, total, list })
            })
        })
    }

    /** 选中按钮时只取自身权限码；选中目录或菜单时取全部下级按钮权限码。 */
    private async resolvePermissionCodes(sheetKeyId: number): Promise<string[] | undefined> {
        if (!isNotEmpty(sheetKeyId)) return undefined
        const sheets = await this.sheetRepository.find({
            select: { keyId: true, parentKeyId: true, type: true, permissionCode: true }
        })
        const children = new Map<number, TbSkylineSheet[]>()
        for (const sheet of sheets) {
            if (!sheet.parentKeyId) continue
            const list = children.get(sheet.parentKeyId) ?? []
            list.push(sheet)
            children.set(sheet.parentKeyId, list)
        }
        const codes: string[] = []
        const visit = (keyId: number) => {
            const current = sheets.find(sheet => sheet.keyId === keyId)
            if (current?.type === TbSkylineSheetType.BUTTON && current.permissionCode) codes.push(current.permissionCode)
            for (const child of children.get(keyId) ?? []) visit(child.keyId)
        }
        visit(sheetKeyId)
        return codes.length ? codes : ['__none__']
    }
}
