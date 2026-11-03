/** Garage S3 默认值。真实密钥只放在 Nacos 或环境变量，不写入仓库。 */
/** 同机服务访问 Garage S3 的 Docker 网络地址，不是管理端口 3903。 */
export const GARAGE_DEFAULT_ENDPOINT = 'http://chat-web-garage:3900'
/** 浏览器预签名使用的公网地址。主机参与签名，不能换成内网地址。 */
export const GARAGE_DEFAULT_PUBLIC_ENDPOINT = 'https://chat-web-garage.lisfes.cn'
/** 必须与 garage.toml 的 s3_region 一致。 */
export const GARAGE_DEFAULT_REGION = 'garage'
/** 默认存储桶。 */
export const GARAGE_DEFAULT_BUCKET = 'chat-web'
/** 预签名默认有效秒数。 */
export const GARAGE_DEFAULT_EXPIRES_IN = 900
/** 预签名允许的最长有效秒数。 */
export const GARAGE_MAX_EXPIRES_IN = 86400
/** 经 Skyline 中转上传的大小上限。更大的文件应走预签名直传。 */
export const GARAGE_MAX_UPLOAD_BYTES = 20 * 1024 * 1024
/** 调用 Garage 管理接口所需权限码。超级管理员不受此限制。 */
export const GARAGE_PERMISSION = 'chat:deploy:garage'

/** 内部 S3 操作客户端注入标记。同机请求走 Docker 网络端点。 */
export const S3 = Symbol('S3')

/** 预签名客户端注入标记。签名主机必须是浏览器可访问的公网端点。 */
export const PUBLIC_S3 = Symbol('PUBLIC_S3')

/** 已解析的 Garage 连接配置注入标记。 */
export const S3_CONFIG = Symbol('S3_CONFIG')
