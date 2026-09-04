import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { createMysqlOptions, DataBaseService } from '@wlisfes/chat-web-base-schema/database'
import { NacosService } from '@wlisfes/chat-web-base-schema/nacos'
import { SKYLINE_MYSQL_CONFIG_KEY, SKYLINE_MYSQL_ENTITIES } from '@/modules/database/database.constants'

/** Skyline 数据库连接与实体注册。 */
@Global()
@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService, NacosService],
            useFactory: async (configService: ConfigService, nacosService: NacosService) => {
                await nacosService.loadConfig()
                const configured = configService.get<Record<string, unknown>>(SKYLINE_MYSQL_CONFIG_KEY)
                // 兼容尚未迁移的历史 Nacos 字段；后续保存配置统一使用 database。
                if (configured && typeof configured.database !== 'string' && typeof configured.name === 'string') {
                    configService.set(SKYLINE_MYSQL_CONFIG_KEY, { ...configured, database: configured.name })
                }
                return createMysqlOptions(configService, {
                    configKey: SKYLINE_MYSQL_CONFIG_KEY,
                    entities: [...SKYLINE_MYSQL_ENTITIES]
                })
            }
        }),
        TypeOrmModule.forFeature([...SKYLINE_MYSQL_ENTITIES])
    ],
    providers: [DataBaseService],
    exports: [TypeOrmModule, DataBaseService]
})
export class DatabaseModule {}
