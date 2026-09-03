import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'

/** Nacos 中 Skyline 服务 MySQL 配置的根路径。 */
export const SKYLINE_MYSQL_CONFIG_KEY = 'database.chat-web-skyline'

/** Skyline 数据库包含的全部 TypeORM 实体。 */
export const SKYLINE_MYSQL_ENTITIES = [TbSkylineDatetaskSystem]
