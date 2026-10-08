import type { Muscle, Prisma } from '@prisma/client';
import { getPrisma } from '../config/prisma';

type ExerciseWithMuscle = Prisma.ExerciseGetPayload<{ include: typeof MUSCLE_SELECT }>;

const MUSCLE_SELECT = {
  muscle: { select: { id: true, name: true, sortOrder: true } },
} satisfies Prisma.ExerciseInclude;

export function findAll(muscleId?: number): Promise<ExerciseWithMuscle[]> {
  return getPrisma().exercise.findMany({
    where: muscleId === undefined ? undefined : { muscleId },
    include: MUSCLE_SELECT,
    // 先按部位的展示顺序，再按插入顺序（seed 的顺序即默认动作的展示顺序）
    orderBy: [{ muscle: { sortOrder: 'asc' } }, { id: 'asc' }],
  });
}

export function findById(id: number): Promise<ExerciseWithMuscle | null> {
  return getPrisma().exercise.findUnique({ where: { id }, include: MUSCLE_SELECT });
}

export function findByMuscleAndName(
  muscleId: number,
  name: string,
): Promise<{ id: number } | null> {
  return getPrisma().exercise.findUnique({
    where: { muscleId_name: { muscleId, name } },
    select: { id: true },
  });
}

export function create(data: {
  name: string;
  muscleId: number;
  description: string | null;
  isCustom: boolean;
}): Promise<ExerciseWithMuscle> {
  return getPrisma().exercise.create({ data, include: MUSCLE_SELECT });
}

export function update(id: number, data: Prisma.ExerciseUpdateInput): Promise<ExerciseWithMuscle> {
  return getPrisma().exercise.update({ where: { id }, data, include: MUSCLE_SELECT });
}

export function remove(id: number): Promise<{ id: number }> {
  return getPrisma().exercise.delete({ where: { id }, select: { id: true } });
}

/** 这个动作被多少条训练记录引用了（用于阻止会丢历史数据的删除） */
export function countUsage(id: number): Promise<number> {
  return getPrisma().workoutExercise.count({ where: { exerciseId: id } });
}

export type { ExerciseWithMuscle, Muscle };
