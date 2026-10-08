import { z } from 'zod';
import { dateKeySchema, idSchema, optionalTextSchema, weightUnitSchema } from './common.schema';

const noteSchema = optionalTextSchema(500, '备注');

/** POST /api/workouts —— 开始训练 */
export const createWorkoutSchema = z.object({
  date: dateKeySchema.optional(),
  note: noteSchema,
});

/** PUT /api/workouts/:id —— 修改训练的日期 / 备注 */
export const updateWorkoutSchema = z
  .object({
    date: dateKeySchema.optional(),
    note: noteSchema,
  })
  .refine((value) => Object.keys(value).length > 0, { message: '至少要修改一个字段' });

/** POST /api/workouts/:id/exercises —— 往训练里加动作 */
export const addWorkoutExerciseSchema = z.object({
  exerciseId: idSchema,
  note: optionalTextSchema(200, '备注'),
});

/** PUT /api/workout-exercises/:id —— 改备注或顺序 */
export const updateWorkoutExerciseSchema = z
  .object({
    note: optionalTextSchema(200, '备注'),
    sortOrder: z.coerce.number().int('顺序必须是整数').min(0, '顺序不能为负').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: '至少要修改一个字段' });

/**
 * PUT /api/workouts/:id/exercises/reorder —— 调整动作顺序
 * 直接传排好序的 id 列表，比逐个改 sortOrder 更不容易出现中间态不一致。
 */
export const reorderWorkoutExercisesSchema = z.object({
  orderedIds: z.array(idSchema).min(1, '至少要有一个动作'),
});

/** 一组训练。weight >= 0、reps > 0 是硬性规则 */
export const createSetSchema = z.object({
  weight: z.coerce
    .number({ invalid_type_error: '重量必须是数字' })
    .min(0, '重量不能为负数')
    .max(2000, '重量超出合理范围'),
  weightUnit: weightUnitSchema.default('kg'),
  reps: z.coerce
    .number({ invalid_type_error: '次数必须是数字' })
    .int('次数必须是整数')
    .min(1, '次数必须大于 0')
    .max(1000, '次数超出合理范围'),
  restSeconds: z.coerce
    .number()
    .int('休息时间必须是整数秒')
    .min(0, '休息时间不能为负')
    .max(36_000, '休息时间超出合理范围')
    .nullable()
    .optional(),
  note: optionalTextSchema(200, '备注'),
  completed: z.boolean().optional(),
});

/** PUT /api/sets/:id —— 改某组 */
export const updateSetSchema = z
  .object({
    weight: z.coerce.number().min(0, '重量不能为负数').max(2000, '重量超出合理范围').optional(),
    weightUnit: weightUnitSchema.optional(),
    reps: z.coerce.number().int('次数必须是整数').min(1, '次数必须大于 0').max(1000).optional(),
    restSeconds: z.coerce
      .number()
      .int('休息时间必须是整数秒')
      .min(0)
      .max(36_000)
      .nullable()
      .optional(),
    note: optionalTextSchema(200, '备注'),
    completed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: '至少要修改一个字段' });

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;
export type AddWorkoutExerciseInput = z.infer<typeof addWorkoutExerciseSchema>;
export type UpdateWorkoutExerciseInput = z.infer<typeof updateWorkoutExerciseSchema>;
export type CreateSetInput = z.infer<typeof createSetSchema>;
export type UpdateSetInput = z.infer<typeof updateSetSchema>;
