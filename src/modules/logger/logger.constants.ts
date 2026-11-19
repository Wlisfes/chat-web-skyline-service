/**
 * 操作日志队列与 Hooks 共用 /chat-sms 虚拟主机：Skyline 只负责发布，Hooks 负责消费入库。
 * 虚拟主机必须与 Hooks 的 RabbitMQ 配置一致，否则消息发不到同一个队列。
 * 本服务不消费该队列，队列和死信由发布端与 Hooks 共同声明。
 */
export const SKYLINE_RABBITMQ_VHOST = '/chat-sms'
