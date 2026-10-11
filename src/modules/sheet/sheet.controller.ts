import { Body, Get, Post, Query } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController, SuccessResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { RequirePermissions, CurrentPrincipal, type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { TbSkylineSheetDto } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { SheetService } from '@/modules/sheet/sheet.service'
import * as SheetDto from '@/modules/sheet/dto/sheet.dto'

@ApifoxController('Skyline 系统菜单', 'deploy/sheet', { bearerAuth: true })
export class SheetController {
    constructor(private readonly sheetService: SheetService) {}

    @RequirePermissions('chat:deploy:system:sheet')
    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '获取菜单类型、状态和显示状态枚举' },
        response: { type: SheetDto.SheetEnumsResponseDto, description: '菜单静态枚举' }
    })
    public async httpBaseSkylineSheetEnums() {
        return this.sheetService.httpBaseSkylineSheetEnums()
    }

    @RequirePermissions('chat:deploy:system:sheet')
    @ApiServiceDecorator(Get('/tree/structure'), {
        operation: { summary: '获取完整菜单树' },
        response: { type: SheetDto.SheetTreeNodeDto, isArray: true, description: '完整菜单树' }
    })
    public async httpBaseSkylineSheetTreeStructure() {
        return this.sheetService.httpBaseSkylineSheetTreeStructure()
    }

    @RequirePermissions('chat:deploy:system:sheet')
    @ApiServiceDecorator(Post('/column'), {
        operation: { summary: '按父菜单分页查询一级及直接下级节点' },
        request: { source: 'body', type: SheetDto.SheetColumnQueryDto },
        response: { type: SheetDto.SheetPageResponseDto, description: '菜单分页数据' }
    })
    public async httpBaseSkylineColumnSheet(@CurrentPrincipal() principal: AuthPrincipal, @Body() body: SheetDto.SheetColumnQueryDto) {
        return this.sheetService.httpBaseSkylineColumnSheet(body)
    }

    @RequirePermissions('chat:deploy:system:sheet')
    @ApiServiceDecorator(Get('/resolve'), {
        operation: { summary: '获取菜单详情' },
        request: { source: 'query', type: SheetDto.SheetKeyDto },
        response: { type: TbSkylineSheetDto, description: '菜单详情' }
    })
    public async httpBaseSkylineSheetResolver(@Query() query: SheetDto.SheetKeyDto) {
        return this.sheetService.httpBaseSkylineSheetResolver(query)
    }

    @RequirePermissions('chat:deploy:system:sheet:create')
    @ApiServiceDecorator(Post('/create'), {
        operation: { summary: '创建目录、菜单或按钮节点' },
        request: { source: 'body', type: SheetDto.CreateSheetDto },
        response: { type: TbSkylineSheetDto, description: '新增后的菜单节点' }
    })
    public async httpBaseSkylineCreateSheet(@Body() input: SheetDto.CreateSheetDto) {
        return this.sheetService.httpBaseSkylineCreateSheet(input)
    }

    @RequirePermissions('chat:deploy:system:sheet:update')
    @ApiServiceDecorator(Post('/update'), {
        operation: { summary: '更新或移动菜单节点' },
        request: { source: 'body', type: SheetDto.UpdateSheetPayloadDto },
        response: { type: TbSkylineSheetDto, description: '更新后的菜单节点' }
    })
    public async httpBaseSkylineUpdateSheet(@Body() input: SheetDto.UpdateSheetPayloadDto) {
        return this.sheetService.httpBaseSkylineUpdateSheet(input)
    }

    @RequirePermissions('chat:deploy:system:sheet:delete')
    @ApiServiceDecorator(Post('/delete'), {
        operation: { summary: '删除没有下级和角色引用的菜单节点' },
        request: { source: 'body', type: SheetDto.SheetKeyDto },
        response: { type: SuccessResponseDataDto, description: '菜单删除结果' }
    })
    public async httpBaseSkylineDeleteSheet(@Body() input: SheetDto.SheetKeyDto) {
        return await this.sheetService.httpBaseSkylineDeleteSheet(input)
    }
}
