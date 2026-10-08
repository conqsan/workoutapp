import { z } from 'zod';

/** 路径参数 :id —— HTTP 传进来的是字符串，用 coerce 转成正整数。 */
export const idParamSchema = z.object({
  id: z.coerce.number().int('ID 必须是整数').positive('ID 必须是正整数'),
});

export const idSchema = z.coerce
  .number({ invalid_type_error: 'ID 必须是正整数' })
  .int('ID 必须是整数')
  .positive('ID 必须是正整数');

/**
 * 日历日期 'YYYY-MM-DD'。
 * 只做正则不够 —— 2026-02-30 也符合格式，所以还要回验一次真实日期。
 */
export const dateKeySchema = z
  .string({ required_error: '日期不能为空' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是 YYYY-MM-DD')
  .refine(isRealDate, '这个日期不存在');

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** 可选文本：空字符串由 service 归一化成 null */
export const optionalTextSchema = (maxLength: number, label: string) =>
  z.string().trim().max(maxLength, `${label}最长 ${maxLength} 个字符`).nullable().optional();

/** 重量单位：目前只支持千克和磅 */
export const weightUnitSchema = z.enum(['kg', 'lb'], {
  invalid_type_error: '重量单位只能是 kg 或 lb',
});

export type IdParam = z.infer<typeof idParamSchema>;
