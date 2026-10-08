import { z } from 'zod';
import { dateKeySchema, idSchema, optionalTextSchema } from './common.schema';

const amountSchema = z.coerce
  .number({ invalid_type_error: '用量必须是数字' })
  .min(0, '用量不能为负数')
  .max(100_000, '用量超出合理范围');

const unitSchema = z.string().trim().min(1, '单位不能为空').max(10, '单位最长 10 个字符');

/** POST /api/supplement-records */
export const createSupplementRecordSchema = z.object({
  supplementId: idSchema,
  /** 不传就用今天 */
  date: dateKeySchema.optional(),
  amount: amountSchema,
  /** 不传就跟随补剂自身的默认单位 */
  unit: unitSchema.optional(),
  consumptionTime: optionalTextSchema(20, '时间'),
  note: optionalTextSchema(200, '备注'),
});

/** PUT /api/supplement-records/:id */
export const updateSupplementRecordSchema = z
  .object({
    supplementId: idSchema.optional(),
    date: dateKeySchema.optional(),
    amount: amountSchema.optional(),
    unit: unitSchema.optional(),
    consumptionTime: optionalTextSchema(20, '时间'),
    note: optionalTextSchema(200, '备注'),
  })
  .refine((value) => Object.keys(value).length > 0, { message: '至少要修改一个字段' });

/** GET /api/supplement-records?date=YYYY-MM-DD&supplementId=1 */
export const listSupplementRecordsQuerySchema = z.object({
  date: dateKeySchema.optional(),
  supplementId: idSchema.optional(),
});

export type CreateSupplementRecordInput = z.infer<typeof createSupplementRecordSchema>;
export type UpdateSupplementRecordInput = z.infer<typeof updateSupplementRecordSchema>;
export type ListSupplementRecordsQuery = z.infer<typeof listSupplementRecordsQuerySchema>;
