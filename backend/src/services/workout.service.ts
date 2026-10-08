import type { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { toDateKey } from '../utils/date';
import { toExerciseDto } from '../utils/dto';
import { normalizeOptionalText } from '../utils/text';
import { calculateTotalVolumeKg, type WeightUnit } from '../utils/weight';
import * as exerciseRepository from '../repositories/exercise.repository';
import * as workoutRepository from '../repositories/workout.repository';
import type { WorkoutDetail } from '../repositories/workout.repository';
import type {
  AddWorkoutExerciseInput,
  CreateSetInput,
  CreateWorkoutInput,
  UpdateSetInput,
  UpdateWorkoutExerciseInput,
  UpdateWorkoutInput,
} from '../schemas/workout.schema';
import type { LastWorkoutDto, WorkoutDto, WorkoutExerciseDto, WorkoutSetDto } from '../types/api';

type WorkoutExerciseDetail = WorkoutDetail['exercises'][number];
type WorkoutSetRow = WorkoutExerciseDetail['sets'][number];

/** 数据库里 weightUnit 是 String，读出来收窄成 'kg' | 'lb' */
function toWeightUnit(value: string): WeightUnit {
  return value === 'lb' ? 'lb' : 'kg';
}

function toSetDto(row: WorkoutSetRow): WorkoutSetDto {
  return {
    id: row.id,
    workoutExerciseId: row.workoutExerciseId,
    setNumber: row.setNumber,
    weight: row.weight,
    weightUnit: toWeightUnit(row.weightUnit),
    reps: row.reps,
    restSeconds: row.restSeconds,
    note: row.note,
    completed: row.completed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toWorkoutExerciseDto(row: WorkoutExerciseDetail): WorkoutExerciseDto {
  return {
    id: row.id,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    exercise: toExerciseDto(row.exercise),
    sortOrder: row.sortOrder,
    note: row.note,
    sets: row.sets.map(toSetDto),
  };
}

function toWorkoutDto(row: WorkoutDetail): WorkoutDto {
  const exercises = row.exercises.map(toWorkoutExerciseDto);
  const allSets = exercises.flatMap((exercise) => exercise.sets);

  return {
    id: row.id,
    date: row.date,
    startTime: row.startTime?.toISOString() ?? null,
    endTime: row.endTime?.toISOString() ?? null,
    note: row.note,
    status: row.status === 'completed' ? 'completed' : 'active',
    exercises,
    // 混着 kg / lb 的组不能直接相加
    totalVolume: calculateTotalVolumeKg(allSets),
    totalSets: allSets.length,
  };
}

async function requireWorkout(id: number): Promise<WorkoutDetail> {
  const workout = await workoutRepository.findById(id);
  if (!workout) {
    throw ApiError.notFound('找不到这次训练，可能已被删除。');
  }
  return workout;
}

// ---------------------------------------------------------------- 训练

/**
 * 开始训练。
 * 同一时间只允许有一次进行中的训练 —— 否则「继续训练」就不知道该接哪一次。
 */
export async function startWorkout(input: CreateWorkoutInput): Promise<WorkoutDto> {
  const active = await workoutRepository.findActive();
  if (active) {
    throw new ApiError(409, 'ACTIVE_WORKOUT_EXISTS', '已经有一次进行中的训练了，先完成或删除它。', {
      workoutId: active.id,
      date: active.date,
    });
  }

  const created = await workoutRepository.create({
    date: input.date ?? toDateKey(new Date()),
    startTime: new Date(),
    note: normalizeOptionalText(input.note) ?? null,
  });

  return toWorkoutDto(created);
}

export async function getWorkout(id: number): Promise<WorkoutDto> {
  return toWorkoutDto(await requireWorkout(id));
}

export async function getActiveWorkout(): Promise<WorkoutDto | null> {
  const active = await workoutRepository.findActive();
  return active ? toWorkoutDto(active) : null;
}

export async function updateWorkout(id: number, input: UpdateWorkoutInput): Promise<WorkoutDto> {
  await requireWorkout(id);

  const data: Prisma.WorkoutUpdateInput = {};
  if (input.date !== undefined) data.date = input.date;
  const note = normalizeOptionalText(input.note);
  if (note !== undefined) data.note = note;

  return toWorkoutDto(await workoutRepository.update(id, data));
}

export async function deleteWorkout(id: number): Promise<{ id: number }> {
  await requireWorkout(id);
  return workoutRepository.remove(id);
}

/**
 * 完成训练。
 * 这里会把所有组标记为已完成 —— 点了「完成训练」就代表这次训练结束了，
 * 不应该再留下半截的未完成组。
 */
export async function completeWorkout(id: number): Promise<WorkoutDto> {
  const workout = await requireWorkout(id);

  if (workout.status === 'completed') {
    throw ApiError.conflict('这次训练已经完成过了。');
  }
  if (workout.exercises.length === 0) {
    throw ApiError.unprocessable('这次训练还没有任何动作，先加一个动作再完成。');
  }

  await workoutRepository.update(id, { status: 'completed', endTime: new Date() });
  await workoutRepository.markAllSetsCompleted(id);

  return getWorkout(id);
}

// ---------------------------------------------------------------- 训练里的动作

export async function addExercise(
  workoutId: number,
  input: AddWorkoutExerciseInput,
): Promise<WorkoutDto> {
  await requireWorkout(workoutId);

  const exercise = await exerciseRepository.findById(input.exerciseId);
  if (!exercise) {
    throw ApiError.badRequest('这个动作不存在，请刷新后重试。');
  }

  await workoutRepository.addExercise({
    workoutId,
    exerciseId: input.exerciseId,
    sortOrder: await workoutRepository.nextSortOrder(workoutId),
    note: normalizeOptionalText(input.note) ?? null,
  });

  return getWorkout(workoutId);
}

export async function updateWorkoutExercise(
  id: number,
  input: UpdateWorkoutExerciseInput,
): Promise<WorkoutDto> {
  const row = await workoutRepository.findWorkoutExerciseById(id);
  if (!row) {
    throw ApiError.notFound('找不到这个训练动作，可能已被删除。');
  }

  const data: Prisma.WorkoutExerciseUpdateInput = {};
  const note = normalizeOptionalText(input.note);
  if (note !== undefined) data.note = note;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  await workoutRepository.updateWorkoutExercise(id, data);
  return getWorkout(row.workoutId);
}

/** 删除训练里的某个动作，返回更新后的整次训练（前端直接用返回结果重绘，不用再请求一次） */
export async function deleteWorkoutExercise(id: number): Promise<WorkoutDto> {
  const row = await workoutRepository.findWorkoutExerciseById(id);
  if (!row) {
    throw ApiError.notFound('找不到这个训练动作，可能已被删除。');
  }

  await workoutRepository.removeWorkoutExercise(id);
  return getWorkout(row.workoutId);
}

export async function reorderExercises(
  workoutId: number,
  orderedIds: number[],
): Promise<WorkoutDto> {
  const workout = await requireWorkout(workoutId);

  const existingIds = workout.exercises.map((exercise) => exercise.id).sort((a, b) => a - b);
  const incomingIds = [...orderedIds].sort((a, b) => a - b);

  // 必须不多不少正好是这个训练里的动作，否则排序结果会不可预期
  if (
    existingIds.length !== incomingIds.length ||
    existingIds.some((id, index) => id !== incomingIds[index])
  ) {
    throw ApiError.badRequest('排序列表和这次训练里的动作对不上，请刷新后重试。');
  }

  await workoutRepository.reorderExercises(workoutId, orderedIds);
  return getWorkout(workoutId);
}

// ---------------------------------------------------------------- 训练组

export async function addSet(
  workoutExerciseId: number,
  input: CreateSetInput,
): Promise<WorkoutDto> {
  const workoutExercise = await workoutRepository.findWorkoutExerciseById(workoutExerciseId);
  if (!workoutExercise) {
    throw ApiError.notFound('找不到这个训练动作，可能已被删除。');
  }

  await workoutRepository.addSet({
    workoutExerciseId,
    setNumber: await workoutRepository.nextSetNumber(workoutExerciseId),
    weight: input.weight,
    weightUnit: input.weightUnit,
    reps: input.reps,
    restSeconds: input.restSeconds ?? null,
    note: normalizeOptionalText(input.note) ?? null,
    completed: input.completed ?? true,
  });

  return getWorkout(workoutExercise.workoutId);
}

export async function updateSet(id: number, input: UpdateSetInput): Promise<WorkoutDto> {
  const existing = await workoutRepository.findSetById(id);
  if (!existing) {
    throw ApiError.notFound('找不到这一组，可能已被删除。');
  }

  const data: Prisma.WorkoutSetUpdateInput = {};
  if (input.weight !== undefined) data.weight = input.weight;
  if (input.weightUnit !== undefined) data.weightUnit = input.weightUnit;
  if (input.reps !== undefined) data.reps = input.reps;
  if (input.restSeconds !== undefined) data.restSeconds = input.restSeconds;
  if (input.completed !== undefined) data.completed = input.completed;
  const note = normalizeOptionalText(input.note);
  if (note !== undefined) data.note = note;

  await workoutRepository.updateSet(id, data);
  return getWorkout(existing.workoutExercise.workoutId);
}

export async function deleteSet(id: number): Promise<WorkoutDto> {
  const existing = await workoutRepository.findSetById(id);
  if (!existing) {
    throw ApiError.notFound('找不到这一组，可能已被删除。');
  }

  const { workoutId } = existing.workoutExercise;
  await workoutRepository.removeSet(id);
  // 删掉中间一组后把组号压回 1..n，避免出现「第 1 组、第 3 组」
  await workoutRepository.renumberSets(existing.workoutExerciseId);

  return getWorkout(workoutId);
}

// ---------------------------------------------------------------- 上一次训练

/** 这个动作最近一次「已完成」训练的数据，用来在训练页提示「上次：80kg × 10」 */
export async function getLastWorkout(exerciseId: number): Promise<LastWorkoutDto | null> {
  const exercise = await exerciseRepository.findById(exerciseId);
  if (!exercise) {
    throw ApiError.notFound('找不到这个动作，可能已被删除。');
  }

  const last = await workoutRepository.findLastCompletedSetsForExercise(exerciseId);
  if (!last) return null;

  return {
    workoutId: last.workoutId,
    date: last.date,
    sets: last.sets.map((set) => ({
      setNumber: set.setNumber,
      weight: set.weight,
      weightUnit: toWeightUnit(set.weightUnit),
      reps: set.reps,
    })),
    totalVolume: calculateTotalVolumeKg(
      last.sets.map((set) => ({ ...set, weightUnit: toWeightUnit(set.weightUnit) })),
    ),
  };
}
