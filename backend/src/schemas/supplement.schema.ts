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

export const createSupplementSchema = z.object({
  name: nameSchema,
  unit: unitSchema.default('g'),
});

export const updateSupplementSchema = z
  .object({
    name: nameSchema.optional(),
    unit: unitSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少要修改一个字段',
  });

export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;
