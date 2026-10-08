import { z } from 'zod';

const nameSchema = z
  .string({ required_error: '补剂名称不能为空' })
  .trim()
  .min(1, '补剂名称不能为空')
  .max(30, '补剂名称最长 30 个字符');

const unitSchema = z
  .string({ required_error: '单位不能为空' })
  .trim()
  .min(1, '单位不能为空')
  .max(10, '单位最长 10 个字符');

/** 可选单位列表（例如 g / 勺）：去重，最多 8 个 */
const unitsSchema = z
  .array(unitSchema, { invalid_type_error: '可选单位必须是数组' })
  .min(1, '可选单位至少要有一个')
  .max(8, '可选单位最多 8 个')
  .transform((units) => Array.from(new Set(units)));

export const createSupplementSchema = z.object({
  name: nameSchema,
  unit: unitSchema.default('g'),
  /** 不传就按 [unit] 处理 */
  units: unitsSchema.optional(),
});

export const updateSupplementSchema = z
  .object({
    name: nameSchema.optional(),
    unit: unitSchema.optional(),
    units: unitsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少要修改一个字段',
  });

export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;
