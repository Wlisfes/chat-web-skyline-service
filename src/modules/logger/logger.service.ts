import { Injectable } from '@nestjs/common'
import { InjectRepository, Repository } from '@wlisfes/chat-web-base-schema/database'
import { fetchResolver, isNotEmpty, PageResult } from '@wlisfes/chat-web-base-schema/utils'
import { TbSkylineLogger, TbSkylineSheet, TbSkylineSheetType } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import * as LoggerDto from '@/modules/logger/dto/logger.dto'

@Injectable()
export class SkylineLoggerService {
    constructor(
        @InjectRepository(TbSkylineLogger) private readonly loggerRepository: Repository<TbSkylineLogger>,
        @InjectRepository(TbSkylineSheet) private readonly sheetRepository: Repository<TbSkylineSheet>
    ) {}

    /** 按菜单节点展开按钮权限码后分页查询。选中目录或菜单时包含全部下级按钮。 */
    public async httpBaseSkylineColumnLogger(
        body: LoggerDto.LoggerColumnQueryDto
    ): Promise<PageResult<TbSkylineLogger>> {
        const permissionCodes = await this.resolvePermissionCodes(body.sheetKeyId)
        return this.loggerRepository.manager
            .createQueryBuilder(TbSkylineLogger, 't')
            .where(permissionCodes ? 't.permissionCode IN (:...permissionCodes)' : '1 = 1', { permissionCodes })
            .andWhere(isNotEmpty(body.permissionCode) ? 't.permissionCode = :permissionCode' : '1 = 1', {
                permissionCode: body.permissionCode
            })
            .andWhere(isNotEmpty(body.operatorName) ? 't.operatorName LIKE :operatorName' : '1 = 1', {
                operatorName: isNotEmpty(body.operatorName) ? `%${body.operatorName.trim()}%` : undefined
            })
            .andWhere(isNotEmpty(body.result) ? 't.result = :result' : '1 = 1', { result: body.result })
            .andWhere(isNotEmpty(body.resourceType) ? 't.resourceType = :resourceType' : '1 = 1', {
                resourceType: body.resourceType
            })
            .andWhere(isNotEmpty(body.resourceId) ? 't.resourceId = :resourceId' : '1 = 1', { resourceId: body.resourceId })
            .andWhere(isNotEmpty(body.startTime) ? 't.createTime >= :startTime' : '1 = 1', { startTime: body.startTime })
            .andWhere(isNotEmpty(body.endTime) ? 't.createTime <= :endTime' : '1 = 1', { endTime: body.endTime })
            .orderBy('t.createTime', 'DESC')
            .addOrderBy('t.keyId', 'DESC')
            .skip((body.page - 1) * body.size)
            .take(body.size)
            .getManyAndCount()
            .then(([list, total]) => fetchResolver({ page: body.page, size: body.size, list, total }))
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
