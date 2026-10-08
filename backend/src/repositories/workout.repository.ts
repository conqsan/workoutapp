import type { Prisma } from '@prisma/client';
import { getPrisma } from '../config/prisma';
import type { WeightUnit } from '../utils/weight';

/**
 * 取一次训练的完整结构：动作（带部位）+ 每个动作的组，都按各自的顺序排好。
 * 训练页要一次性拿到全部内容，避免前端来回请求。
 */
const WORKOUT_DETAIL_INCLUDE = {
  exercises: {
    orderBy: { sortOrder: 'asc' },
    include: {
      exercise: {
        include: { muscle: { select: { id: true, name: true, sortOrder: true } } },
      },
      sets: { orderBy: { setNumber: 'asc' } },
    },
  },
} satisfies Prisma.WorkoutInclude;

export type WorkoutDetail = Prisma.WorkoutGetPayload<{ include: typeof WORKOUT_DETAIL_INCLUDE }>;

export function create(data: { date: string; startTime: Date; note: string | null }) {
  return getPrisma().workout.create({
    data: { ...data, status: 'active' },
    include: WORKOUT_DETAIL_INCLUDE,
  });
}

export function findById(id: number): Promise<WorkoutDetail | null> {
  return getPrisma().workout.findUnique({ where: { id }, include: WORKOUT_DETAIL_INCLUDE });
}

/** 当前进行中的训练（正常最多只有一条） */
export function findActive() {
  return getPrisma().workout.findFirst({
    where: { status: 'active' },
    orderBy: { id: 'desc' },
    include: WORKOUT_DETAIL_INCLUDE,
  });
}

export function update(id: number, data: Prisma.WorkoutUpdateInput): Promise<WorkoutDetail> {
  return getPrisma().workout.update({ where: { id }, data, include: WORKOUT_DETAIL_INCLUDE });
}

export function remove(id: number): Promise<{ id: number }> {
  // workoutExercises / workoutSets 设了 onDelete: Cascade，删训练会一并清掉
  return getPrisma().workout.delete({ where: { id }, select: { id: true } });
}

export function countExercises(workoutId: number): Promise<number> {
  return getPrisma().workoutExercise.count({ where: { workoutId } });
}

export function countSets(workoutId: number): Promise<number> {
  return getPrisma().workoutSet.count({ where: { workoutExercise: { workoutId } } });
}

// ---------------------------------------------------------------- 训练里的动作

export function findWorkoutExerciseById(id: number) {
  return getPrisma().workoutExercise.findUnique({
    where: { id },
    include: {
      exercise: { include: { muscle: { select: { id: true, name: true, sortOrder: true } } } },
      sets: { orderBy: { setNumber: 'asc' } },
    },
  });
}

export async function nextSortOrder(workoutId: number): Promise<number> {
  const last = await getPrisma().workoutExercise.findFirst({
    where: { workoutId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

export function addExercise(data: {
  workoutId: number;
  exerciseId: number;
  sortOrder: number;
  note: string | null;
}) {
  return getPrisma().workoutExercise.create({ data });
}

export function updateWorkoutExercise(id: number, data: Prisma.WorkoutExerciseUpdateInput) {
  return getPrisma().workoutExercise.update({ where: { id }, data });
}

export function removeWorkoutExercise(id: number): Promise<{ id: number }> {
  return getPrisma().workoutExercise.delete({ where: { id }, select: { id: true } });
}

/** 按传来的 id 顺序重排 sortOrder（0..n-1），并校验这些 id 都属于该训练 */
export async function reorderExercises(workoutId: number, orderedIds: number[]): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.workoutExercise.updateMany({
        where: { id, workoutId },
        data: { sortOrder: index },
      }),
    ),
  );
}

// ---------------------------------------------------------------- 训练组

export function findSetById(id: number) {
  return getPrisma().workoutSet.findUnique({
    where: { id },
    include: { workoutExercise: { select: { id: true, workoutId: true } } },
  });
}

export async function nextSetNumber(workoutExerciseId: number): Promise<number> {
  const last = await getPrisma().workoutSet.findFirst({
    where: { workoutExerciseId },
    orderBy: { setNumber: 'desc' },
    select: { setNumber: true },
  });
  return (last?.setNumber ?? 0) + 1;
}

export function addSet(data: {
  workoutExerciseId: number;
  setNumber: number;
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
  restSeconds: number | null;
  note: string | null;
  completed: boolean;
}) {
  return getPrisma().workoutSet.create({ data });
}

export function updateSet(id: number, data: Prisma.WorkoutSetUpdateInput) {
  return getPrisma().workoutSet.update({ where: { id }, data });
}

export function removeSet(id: number): Promise<{ id: number }> {
  return getPrisma().workoutSet.delete({ where: { id }, select: { id: true } });
}

/** 完成训练时把所有组一并标记为已完成 */
export function markAllSetsCompleted(workoutId: number): Promise<{ count: number }> {
  return getPrisma().workoutSet.updateMany({
    where: { workoutExercise: { workoutId } },
    data: { completed: true },
  });
}

/**
 * 删掉中间某一组之后，把剩下的组号重新压成 1..n。
 * 否则会出现「第1组、第3组」这种断号，历史页看起来很奇怪。
 */
export async function renumberSets(workoutExerciseId: number): Promise<void> {
  await getPrisma().$transaction(async (tx) => {
    const sets = await tx.workoutSet.findMany({
      where: { workoutExerciseId },
      orderBy: { setNumber: 'asc' },
      select: { id: true },
    });

    for (const [index, set] of sets.entries()) {
      const target = index + 1;
      // 只压号不换序，目标组号一定小于等于原组号，不会撞上唯一约束
      await tx.workoutSet.update({ where: { id: set.id }, data: { setNumber: target } });
    }
  });
}

// ---------------------------------------------------------------- 上一次训练

/**
 * 找这个动作「最近一次完成的训练」里的那一组数据。
 * 只认 completed —— 进行中的训练不算历史战绩。
 */
export async function findLastCompletedSetsForExercise(exerciseId: number) {
  const prisma = getPrisma();

  const row = await prisma.workoutExercise.findFirst({
    where: { exerciseId, workout: { status: 'completed' } },
    orderBy: [{ workout: { date: 'desc' } }, { workout: { id: 'desc' } }],
    select: { id: true, workout: { select: { id: true, date: true } } },
  });

  if (!row) return null;

  const sets = await prisma.workoutSet.findMany({
    where: { workoutExerciseId: row.id },
    orderBy: { setNumber: 'asc' },
    select: { setNumber: true, weight: true, weightUnit: true, reps: true },
  });

  return { workoutId: row.workout.id, date: row.workout.date, sets };
}
