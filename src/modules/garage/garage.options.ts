import { S3Client } from '@aws-sdk/client-s3'
import { BadRequestException, Provider, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NacosService } from '@wlisfes/chat-web-base-schema/nacos'
import * as GarageConst from '@/modules/garage/garage.constants'

/** Garage 连接配置。优先读 Nacos garage 节点，缺省项回退环境变量和默认值。 */
export interface GarageConfig {
    endpoint: string
    publicEndpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    forcePathStyle: boolean
}

/** 把 Nacos 对象、环境变量和默认值收敛成 Garage 连接配置。 */
export function resolveGarageConfig(source: Record<string, unknown> | undefined, env: NodeJS.ProcessEnv = process.env): GarageConfig {
    const config = source ?? {}
    return {
        endpoint: readString(config.endpoint, env.GARAGE_ENDPOINT, GarageConst.GARAGE_DEFAULT_ENDPOINT),
        publicEndpoint: readString(config.publicEndpoint, env.GARAGE_PUBLIC_ENDPOINT, GarageConst.GARAGE_DEFAULT_PUBLIC_ENDPOINT),
        region: readString(config.region, env.GARAGE_REGION, GarageConst.GARAGE_DEFAULT_REGION),
        bucket: readString(config.bucket, env.GARAGE_BUCKET, GarageConst.GARAGE_DEFAULT_BUCKET),
        accessKeyId: readString(config.accessKeyId, env.GARAGE_ACCESS_KEY_ID, ''),
        secretAccessKey: readString(config.secretAccessKey, env.GARAGE_SECRET_ACCESS_KEY, ''),
        forcePathStyle: readBoolean(config.forcePathStyle, env.GARAGE_FORCE_PATH_STYLE, true)
    }
}

/** 创建 path-style S3 客户端。关闭默认校验和，避免 Garage 拒绝额外的 checksum 头。 */
export function createGarageClient(config: GarageConfig, endpoint = config.endpoint): S3Client {
    if (!config.forcePathStyle) {
        throw new BadRequestException('Garage 客户端必须使用 path-style')
    }
    if (!config.accessKeyId || !config.secretAccessKey) {
        throw new ServiceUnavailableException('Garage 访问密钥未配置，请在 Nacos garage 节点或 GARAGE_ACCESS_KEY_ID 中配置')
    }
    return new S3Client({
        region: config.region,
        endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
        },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED'
    })
}

/** 先加载 Nacos，再解析 garage 连接配置。密钥缺失时由创建客户端的工厂拒绝启动。 */
async function loadGarageConfig(configService: ConfigService, nacosService: NacosService): Promise<GarageConfig> {
    await nacosService.loadConfig()
    return resolveGarageConfig(configService.get<Record<string, unknown>>('garage'))
}

/** 解析后的连接配置。客户端工厂从这里取端点和密钥。 */
export const configProvider: Provider = {
    provide: GarageConst.S3_CONFIG,
    inject: [ConfigService, NacosService],
    useFactory: (configService: ConfigService, nacosService: NacosService) => loadGarageConfig(configService, nacosService)
}

/** 内部 S3 客户端。注入后直接使用 send。 */
export const s3Provider: Provider = {
    provide: GarageConst.S3,
    inject: [GarageConst.S3_CONFIG],
    useFactory: (config: GarageConfig) => createGarageClient(config, config.endpoint)
}

/** 公网预签名客户端。主机参与签名，不能和内部客户端混用。 */
export const publicS3Provider: Provider = {
    provide: GarageConst.PUBLIC_S3,
    inject: [GarageConst.S3_CONFIG],
    useFactory: (config: GarageConfig) => createGarageClient(config, config.publicEndpoint)
}

/** 便于按 S3Client 类型注入内部客户端。 */
export const s3Alias: Provider = {
    provide: S3Client,
    useExisting: GarageConst.S3
}

/** Nacos 字符串优先，其次环境变量，最后默认值。空白字符串视为未配置。 */
function readString(configValue: unknown, envValue: string | undefined, fallback: string): string {
    if (typeof configValue === 'string' && configValue.trim()) {
        return configValue.trim()
    }
    if (typeof envValue === 'string' && envValue.trim()) {
        return envValue.trim()
    }
    return fallback
}

/** 布尔配置。false、0、no、off 视为关闭，未配置时使用默认值。 */
function readBoolean(configValue: unknown, envValue: string | undefined, fallback: boolean): boolean {
    if (typeof configValue === 'boolean') {
        return configValue
    }
    const raw = typeof configValue === 'string' && configValue.trim() ? configValue : envValue
    if (typeof raw !== 'string' || !raw.trim()) {
        return fallback
    }
    return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase())
}
