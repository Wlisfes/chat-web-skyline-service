import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { EnumsResponseDto, PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import { Transform, Type } from 'class-transformer'
import * as Schema from '@wlisfes/chat-web-base-schema'
import * as feign from '@wlisfes/chat-web-base-schema/feign'

/** 枚举字典分页查询参数。 */
export class ListChunkDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSkylineChunkDto, ['module', 'type', 'name', 'pid', 'status'] as const))
) {}

/** 枚举分类分页查询参数；分类数据由 SQL 种子维护，接口只提供列表。 */
export class ListChunkModuleDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSkylineChunkModuleDto, ['module', 'name', 'kind'] as const))
) {}

/** 枚举字典主键参数。 */
export class ChunkKeyDto {
    @ApiProperty({ description: '枚举项主键', example: 10000 })
    @Type(() => Number)
    @IsInt({ message: '枚举项主键必须是整数' })
    @Min(1, { message: '枚举项主键必须大于0' })
    keyId: number
}

/** 枚举字典树结构查询参数：GET /deploy/chunk/tree/structure。 */
export class ChunkTreeQueryDto extends PickType(Schema.TbSkylineChunkDto, ['module', 'type'] as const) {
    @ApiPropertyOptional({ description: '编辑中的枚举项主键；传入后排除自身及其子孙节点', example: 10000 })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '枚举项主键必须是整数' })
    @Min(1, { message: '枚举项主键必须大于0' })
    keyId?: number
}

/** 新增枚举字典参数。 */
export class CreateChunkDto extends IntersectionType(
    PickType(Schema.TbSkylineChunkDto, ['pid', 'module', 'type', 'name', 'json'] as const),
    PickType(Schema.TbSkylineChunkDto, ['sort', 'status', 'allowDelete', 'allowUpdate'] as const)
) {
    @ApiProperty({ description: '枚举项业务值；为空时默认使用新增后的枚举项主键', required: false, example: 'running' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsOptional()
    @IsString({ message: '枚举项业务值必须是字符串' })
    @MaxLength(128, { message: '枚举项业务值长度不能超过128位' })
    value?: string
}

/** 更新枚举字典参数。 */
export class UpdateChunkDto extends IntersectionType(ChunkKeyDto, PartialType(CreateChunkDto)) {}

/** 枚举字典详情响应。 */
export class ChunkResponseDto extends Schema.TbSkylineChunkDto {}

/** 枚举字典树节点响应：GET /deploy/chunk/tree/structure。 */
export class ChunkTreeNodeResponseDto extends IntersectionType(
    PickType(Schema.TbSkylineChunkDto, ['keyId', 'pid', 'module', 'type'] as const),
    PickType(Schema.TbSkylineChunkDto, ['name', 'value', 'sort', 'status'] as const)
) {
    @ApiProperty({ description: '子枚举项节点', type: () => ChunkTreeNodeResponseDto, isArray: true, example: [] })
    children: ChunkTreeNodeResponseDto[]
}

/** 枚举字典列表项响应：补充创建人、更新人选项。 */
export class ChunkColumnResponseDto extends IntersectionType(ChunkResponseDto, feign.SkylineUserOptionsResponseDto) {
    @ApiProperty({
        description: '子枚举项；枚举分类字段类型为 tree 时返回树结构，select 时不返回',
        type: () => ChunkColumnResponseDto,
        isArray: true,
        required: false,
        example: []
    })
    items?: ChunkColumnResponseDto[]
}

/** 枚举字典分页响应。 */
export class ChunkPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '枚举字典列表', type: [ChunkColumnResponseDto] })
    list: ChunkColumnResponseDto[]
}

/** 枚举分类详情响应。 */
export class ChunkModuleResponseDto extends IntersectionType(Schema.TbSkylineChunkModuleDto, feign.SkylineUserOptionsResponseDto) {
    @ApiProperty({ description: '子表枚举项数量，按 module + type 联查 tb_skyline_chunk', example: 65, readOnly: true })
    chunkCount: number
}

/** 枚举分类分页响应。 */
export class ChunkModulePageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '枚举分类列表', type: [ChunkModuleResponseDto] })
    list: ChunkModuleResponseDto[]
}

/** 枚举字典删除响应。 */
export class DeleteChunkResponseDto {
    @ApiProperty({ description: '是否删除成功', example: true })
    success: true
}

/** 枚举字典静态枚举响应。 */
export class ChunkEnumsResponseDto extends EnumsResponseDto({
    moduleOptions: { description: '枚举所属模块选项', example: Schema.TbSkylineChunkModuleDefinition.options },
    kindOptions: { description: '枚举字段类型选项', example: Schema.TbSkylineChunkModuleKindDefinition.options },
    statusOptions: { description: '枚举项状态选项', example: Schema.TbSkylineChunkStatusDefinition.options }
}) {}
