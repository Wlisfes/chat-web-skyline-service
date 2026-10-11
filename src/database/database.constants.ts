import {
    TbSkylineChunk,
    TbSkylineChunkModuleEntity,
    TbSkylineDatetaskLog,
    TbSkylineDatetaskSystem,
    TbSkylineOrganization,
    TbSkylineOrganizationClosure,
    TbSkylineRole,
    TbSkylineRoleDataScope,
    TbSkylineRoleDataScopeOrganization,
    TbSkylineRoleSheet,
    TbSkylineSheet,
    TbSkylineUser,
    TbSkylineUserChunk,
    TbSkylineUserOrganization,
    TbSkylineUserRole
} from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'

/** Nacos 中 Skyline 服务 MySQL 配置的根路径。 */
export const SKYLINE_MYSQL_CONFIG_KEY = 'database.chat-web-skyline'

/** Skyline 数据库包含的全部 TypeORM 实体。 */
export const SKYLINE_MYSQL_ENTITIES = [
    TbSkylineChunk,
    TbSkylineChunkModuleEntity,
    TbSkylineDatetaskSystem,
    TbSkylineDatetaskLog,
    TbSkylineUser,
    TbSkylineOrganization,
    TbSkylineOrganizationClosure,
    TbSkylineUserOrganization,
    TbSkylineSheet,
    TbSkylineRole,
    TbSkylineUserRole,
    TbSkylineRoleSheet,
    TbSkylineRoleDataScope,
    TbSkylineRoleDataScopeOrganization,
    TbSkylineUserChunk
]
