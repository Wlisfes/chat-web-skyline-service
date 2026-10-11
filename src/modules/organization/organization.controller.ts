import { Body, Get, Post, Query } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController, SuccessResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { RequirePermissions } from '@wlisfes/chat-web-base-schema/auth'
import { TbSkylineOrganizationDto } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { OrganizationService } from '@/modules/organization/organization.service'
import * as OrganizationDto from '@/modules/organization/dto/organization.dto'

@ApifoxController('Skyline 组织架构', 'deploy/organization', { bearerAuth: true })
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @RequirePermissions('chat:deploy:system:organization')
    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '获取组织类型和状态枚举' },
        response: { type: OrganizationDto.OrganizationEnumsResponseDto, description: '组织静态枚举' }
    })
    public async httpBaseSkylineOrganizationEnums() {
        return this.organizationService.httpBaseSkylineOrganizationEnums()
    }

    @RequirePermissions('chat:deploy:system:organization')
    @ApiServiceDecorator(Get('tree/structure'), {
        operation: { summary: '获取组织树；传入组织主键时只返回该组织的下级子树' },
        request: { source: 'query', type: OrganizationDto.OrganizationTreeQueryDto },
        response: { type: OrganizationDto.OrganizationTreeNodeResponseDto, isArray: true, description: '组织树' }
    })
    public async httpBaseSkylineOrganizationTreeStructure(@Query() query: OrganizationDto.OrganizationTreeQueryDto) {
        return this.organizationService.httpBaseSkylineOrganizationTreeStructure(query)
    }

    @RequirePermissions('chat:deploy:system:organization')
    @ApiServiceDecorator(Get('tree/user'), {
        operation: { summary: '获取带启用成员的完整组织树' },
        response: { type: OrganizationDto.OrganizationUserNodeResponseDto, isArray: true, description: '带启用成员的完整组织树' }
    })
    public async httpBaseSkylineOrganizationTreeUser() {
        return this.organizationService.httpBaseSkylineOrganizationTreeUser()
    }

    @RequirePermissions('chat:deploy:system:organization')
    @ApiServiceDecorator(Get('column/user'), {
        operation: { summary: '按组织主键获取该组织的直接启用成员' },
        request: { source: 'query', type: OrganizationDto.OrganizationKeyDto },
        response: { type: OrganizationDto.OrganizationUserResponseDto, isArray: true, description: '组织直接成员列表' }
    })
    public async httpBaseSkylineOrganizationColumnUser(@Query() query: OrganizationDto.OrganizationKeyDto) {
        return this.organizationService.httpBaseSkylineOrganizationColumnUser(query)
    }

    @RequirePermissions('chat:deploy:system:organization')
    @ApiServiceDecorator(Get('resolve'), {
        operation: { summary: '获取组织详情' },
        request: { source: 'query', type: OrganizationDto.OrganizationKeyDto },
        response: { type: TbSkylineOrganizationDto, description: '组织详情' }
    })
    public async httpBaseSkylineOrganizationResolver(@Query() query: OrganizationDto.OrganizationKeyDto) {
        return this.organizationService.httpBaseSkylineOrganizationResolver(query)
    }

    @RequirePermissions('chat:deploy:system:organization:create')
    @ApiServiceDecorator(Post('create'), {
        operation: { summary: '创建组织节点' },
        request: { source: 'body', type: OrganizationDto.CreateOrganizationDto },
        response: { type: TbSkylineOrganizationDto, description: '新增后的组织节点' }
    })
    public async httpBaseSkylineCreateOrganization(@Body() input: OrganizationDto.CreateOrganizationDto) {
        return this.organizationService.httpBaseSkylineCreateOrganization(input)
    }

    @RequirePermissions('chat:deploy:system:organization:update')
    @ApiServiceDecorator(Post('update'), {
        operation: { summary: '更新或移动组织节点' },
        request: { source: 'body', type: OrganizationDto.UpdateOrganizationPayloadDto },
        response: { type: TbSkylineOrganizationDto, description: '更新后的组织节点' }
    })
    public async httpBaseSkylineUpdateOrganization(@Body() input: OrganizationDto.UpdateOrganizationPayloadDto) {
        return this.organizationService.httpBaseSkylineUpdateOrganization(input)
    }

    @RequirePermissions('chat:deploy:system:organization:delete')
    @ApiServiceDecorator(Post('delete'), {
        operation: { summary: '删除没有下级、成员和权限引用的组织节点' },
        request: { source: 'body', type: OrganizationDto.OrganizationKeyDto },
        response: { type: SuccessResponseDataDto, description: '组织删除结果' }
    })
    public async httpBaseSkylineDeleteOrganization(@Body() input: OrganizationDto.OrganizationKeyDto) {
        return this.organizationService.httpBaseSkylineDeleteOrganization(input)
    }

    @RequirePermissions('chat:deploy:system:organization:update')
    @ApiServiceDecorator(Post('update/user'), {
        operation: { summary: '按账号UID全集同步组织成员' },
        request: { source: 'body', type: OrganizationDto.UpdateOrganizationUsersDto },
        response: { type: SuccessResponseDataDto, description: '组织成员更新结果' }
    })
    public async httpBaseSkylineUpdateOrganizationUser(@Body() input: OrganizationDto.UpdateOrganizationUsersDto) {
        return this.organizationService.httpBaseSkylineUpdateOrganizationUser(input)
    }
}
