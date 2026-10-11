import { Body, Get, Post, Query } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController, SuccessResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { CurrentPrincipal, RequirePermissions, type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { UserService } from '@/modules/user/user.service'
import * as UserDto from '@/modules/user/dto/user.dto'

@ApifoxController('Skyline 账号管理', 'deploy/user', { bearerAuth: true })
export class UserController {
    constructor(private readonly userService: UserService) {}

    @RequirePermissions('chat:deploy:system:user')
    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '获取账号状态、员工状态和组织关系状态枚举' },
        response: { type: UserDto.UserEnumsResponseDto, description: '账号静态枚举' }
    })
    public async httpBaseSkylineUserEnums() {
        return this.userService.httpBaseSkylineUserEnums()
    }

    @RequirePermissions('chat:deploy:system:user:create')
    @ApiServiceDecorator(Post('create'), {
        operation: { summary: '创建账号并可原子设置组织和角色' },
        request: { source: 'body', type: UserDto.CreateUserDto },
        response: { type: UserDto.SkylineUserResponseDto, description: '新增后的账号信息' }
    })
    public async httpBaseSkylineCreateUser(@CurrentPrincipal() principal: AuthPrincipal, @Body() input: UserDto.CreateUserDto) {
        return this.userService.httpBaseSkylineCreateUser(principal, input)
    }

    @RequirePermissions('chat:deploy:system:user')
    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '分页查询账号' },
        request: { source: 'body', type: UserDto.UserQueryDto },
        response: { type: UserDto.UserPageResponseDto, description: '账号分页数据' }
    })
    public async httpBaseSkylineColumnUser(@Body() input: UserDto.UserQueryDto) {
        return this.userService.httpBaseSkylineColumnUser(input)
    }

    @RequirePermissions('chat:deploy:system:user')
    @ApiServiceDecorator(Get('select'), {
        operation: { summary: '获取账号下拉选项' },
        response: { type: UserDto.SkylineUserSelectResponseDto, isArray: true, description: '账号下拉选项' }
    })
    public async httpBaseSkylineSelectUser() {
        return this.userService.httpBaseSkylineSelectUser()
    }

    @RequirePermissions('chat:deploy:system:user')
    @ApiServiceDecorator(Get('resolve'), {
        operation: { summary: '获取账号详情' },
        request: { source: 'query', type: UserDto.UserUidDto },
        response: { type: UserDto.UserDetailResponseDto, description: '账号详情' }
    })
    public async httpBaseSkylineUserResolver(@Query() query: UserDto.UserUidDto) {
        return this.userService.httpBaseSkylineUserResolver(query)
    }

    @RequirePermissions('chat:deploy:system:user:update')
    @ApiServiceDecorator(Post('update'), {
        operation: { summary: '更新账号资料和状态' },
        request: { source: 'body', type: UserDto.UpdateUserPayloadDto },
        response: { type: UserDto.SkylineUserResponseDto, description: '更新后的账号信息' }
    })
    public async httpBaseSkylineUpdateUser(@Body() input: UserDto.UpdateUserPayloadDto) {
        return this.userService.httpBaseSkylineUpdateUser(input)
    }

    @RequirePermissions('chat:deploy:system:user:password:reset')
    @ApiServiceDecorator(Post('reset/password'), {
        operation: { summary: '超级管理员重置账号密码' },
        request: { source: 'body', type: UserDto.ResetUserPasswordPayloadDto },
        response: { type: SuccessResponseDataDto, description: '密码重置结果' }
    })
    public async httpBaseSkylineResetUserPassword(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: UserDto.ResetUserPasswordPayloadDto
    ) {
        return this.userService.httpBaseSkylineResetUserPassword(principal, input)
    }

    @RequirePermissions('chat:deploy:system:user:organization:measure')
    @ApiServiceDecorator(Post('update/organization'), {
        operation: { summary: '替换账号的主组织和兼任组织' },
        request: { source: 'body', type: UserDto.ReplaceUserOrganizationsPayloadDto },
        response: { type: SuccessResponseDataDto, description: '账号组织关系更新结果' }
    })
    public async httpBaseSkylineUpdateUserOrganization(@Body() input: UserDto.ReplaceUserOrganizationsPayloadDto) {
        return this.userService.httpBaseSkylineUpdateUserOrganization(input)
    }

    @RequirePermissions('chat:deploy:system:user:role:measure')
    @ApiServiceDecorator(Post('update/role'), {
        operation: { summary: '替换账号的全部角色' },
        request: { source: 'body', type: UserDto.ReplaceUserRolesPayloadDto },
        response: { type: SuccessResponseDataDto, description: '账号角色更新结果' }
    })
    public async httpBaseSkylineUpdateUserRole(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: UserDto.ReplaceUserRolesPayloadDto
    ) {
        return this.userService.httpBaseSkylineUpdateUserRole(principal, input)
    }
}
