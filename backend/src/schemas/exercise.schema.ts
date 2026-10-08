import { z } from 'zod';

const nameSchema = z
  .string({ required_error: '动作名称不能为空' })
  .trim()
  .min(1, '动作名称不能为空')
  .max(50, '动作名称最长 50 个字符');

const muscleIdSchema = z.coerce
  .number({ invalid_type_error: '请选择训练部位' })
  .int('请选择训练部位')
  .positive('请选择训练部位');

/** description 允许空字符串，由 service 归一化成 null */
const descriptionSchema = z.string().trim().max(200, '描述最长 200 个字符').nullable().optional();

export const createExerciseSchema = z.object({
  name: nameSchema,
  muscleId: muscleIdSchema,
  description: descriptionSchema,
});

export const updateExerciseSchema = z
  .object({
    name: nameSchema.optional(),
    muscleId: muscleIdSchema.optional(),
    description: descriptionSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少要修改一个字段',
  });

export const listExercisesQuerySchema = z.object({
  muscleId: muscleIdSchema.optional(),
});

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
