import exercisesJson from '@shared/defaults/exercises.json';
import musclesJson from '@shared/defaults/muscles.json';
import supplementsJson from '@shared/defaults/supplements.json';
import { getAll, get, put, remove, Store, type MetaRow } from './db';
import { ensureDefaultsSeeded, normalizeUnits } from './defaults';
import { createId } from './ids';
import type { Exercise, Muscle, Supplement, WorkoutExercise } from './types';

/**
 * 默认数据和本机数据的同步。
 *
 * 为什么需要它：默认部位 / 动作来自 shared/defaults/*.json，而用户的手机里早就
 * 写了一份副本。如果只改 JSON，老用户永远看不到新增的动作；删掉某个部位也一样，
 * 它会一直留在列表里。
 *
 * 规则（两条都很重要）：
 *   1. 补：JSON 里新增的默认项，按**名字**匹配后补进去（按 id 会因为顺序变化错认）
 *   2. 删：JSON 里已经没有、**并且没有任何引用的**默认项才删
 *      —— 用户自己建的动作不动；有训练历史的动作也不动（历史不能丢）
 *
 * 另外，整个过程**只在版本号变化时跑一次**（SYNC_VERSION）。
 * 否则每次打开 App 都会把用户特意删掉的默认动作 / 补剂又加回来。
 */

interface MuscleSeed {
  name: string;
  sortOrder: number;
}

interface ExerciseSeed {
  muscle: string;
  name: string;
}

interface SupplementSeed {
  name: string;
  unit: string;
  units?: readonly string[];
}

const muscleSeeds: readonly MuscleSeed[] = musclesJson;
const exerciseSeeds: readonly ExerciseSeed[] = exercisesJson;
const supplementSeeds: readonly SupplementSeed[] = supplementsJson;

const defaultMuscleNames = new Set(muscleSeeds.map((muscle) => muscle.name));

/** 用「部位 + 动作名」当键，因为同一个动作名可以属于不同部位 */
function exerciseKey(muscleName: string, exerciseName: string): string {
  return `${muscleName}\u0000${exerciseName}`;
}

const defaultExerciseKeys = new Set(
  exerciseSeeds.map((exercise) => exerciseKey(exercise.muscle, exercise.name)),
);
const SYNC_VERSION_KEY = 'defaults-sync-version';
/** 改动 shared/defaults 里「增删」时把这个数字 +1，老用户下次打开才会同步到 */
const SYNC_VERSION = 3;

/**
 * 合并可选单位：seed 里的是「官方顺序」，本地多出来的（用户自己加的）追加在后面。
 * 只加不减 —— 不把用户手里的单位列表改小。
 */
function mergeUnits(local: readonly string[], seed: readonly string[]): string[] {
  const merged: string[] = [];
  for (const unit of [...seed, ...local]) {
    const trimmed = unit.trim();
    if (trimmed.length > 0 && !merged.includes(trimmed)) merged.push(trimmed);
  }
  return merged;
}

/** 把 JSON 里新增的默认项补进本机库 */
async function mergeMissingDefaults(): Promise<void> {
  const [muscles, exercises, supplements] = await Promise.all([
    getAll<Muscle>(Store.muscles),
    getAll<Exercise>(Store.exercises),
    getAll<Supplement>(Store.supplements),
  ]);

  // ---- 部位：按名字匹配，只补缺的，顺带纠正排序
  const muscleByName = new Map(muscles.map((muscle) => [muscle.name, muscle]));
  for (const seed of muscleSeeds) {
    const existing = muscleByName.get(seed.name);
    if (existing) {
      if (existing.sortOrder !== seed.sortOrder) {
        await put(Store.muscles, { ...existing, sortOrder: seed.sortOrder });
      }
      continue;
    }

    const created: Muscle = {
      id: createId('m'),
      name: seed.name,
      sortOrder: seed.sortOrder,
    };
    await put(Store.muscles, created);
    muscleByName.set(created.name, created);
  }

  // ---- 动作：按「部位名 + 动作名」匹配
  const muscleNameById = new Map(
    [...muscleByName.values()].map((muscle) => [muscle.id, muscle.name]),
  );
  const existingKeys = new Set(
    exercises.map((exercise) =>
      exerciseKey(muscleNameById.get(exercise.muscleId) ?? '', exercise.name),
    ),
  );

  for (const [index, seed] of exerciseSeeds.entries()) {
    if (existingKeys.has(exerciseKey(seed.muscle, seed.name))) continue;

    const muscleId = muscleByName.get(seed.muscle)?.id;
    if (muscleId === undefined) {
      console.warn(`[FitLog] 默认动作「${seed.name}」引用了不存在的部位「${seed.muscle}」，已跳过`);
      continue;
    }

    await put(Store.exercises, {
      id: createId('e'),
      name: seed.name,
      muscleId,
      description: null,
      isCustom: false,
      sortOrder: index,
    } satisfies Exercise);
  }

  // ---- 补剂：按名字匹配
  for (const [index, seed] of supplementSeeds.entries()) {
    const existing = supplements.find((item) => item.name === seed.name);
    if (existing) {
      // 已有的补剂只补「可选单位」（例如蛋白粉新增了「勺」），单位列表不会变短
      const merged = mergeUnits(normalizeUnits(existing), normalizeUnits(seed));
      const current = normalizeUnits(existing);
      if (merged.length !== current.length || merged.some((unit, at) => unit !== current[at])) {
        await put(Store.supplements, { ...existing, units: merged });
      }
      continue;
    }

    await put(Store.supplements, {
      id: createId('sup'),
      name: seed.name,
      unit: seed.unit,
      units: normalizeUnits(seed),
      isDefault: true,
      sortOrder: index,
    } satisfies Supplement);
  }
}

/** 清掉 JSON 里已经移除、而且没有任何引用的默认项 */
async function removeStaleDefaults(): Promise<void> {
  const [muscles, exercises, workoutExercises] = await Promise.all([
    getAll<Muscle>(Store.muscles),
    getAll<Exercise>(Store.exercises),
    getAll<WorkoutExercise>(Store.workoutExercises),
  ]);

  const muscleNameById = new Map(muscles.map((muscle) => [muscle.id, muscle.name]));
  const referencedExerciseIds = new Set(workoutExercises.map((entry) => entry.exerciseId));

  // 1) 被删掉的默认动作：只删「默认的」且「没有任何训练引用」的
  for (const exercise of exercises) {
    if (exercise.isCustom) continue;
    const muscleName = muscleNameById.get(exercise.muscleId) ?? '';
    if (defaultExerciseKeys.has(exerciseKey(muscleName, exercise.name))) continue;
    if (referencedExerciseIds.has(exercise.id)) continue;
    await remove(Store.exercises, exercise.id);
  }

  // 2) 被删掉的部位：只删「下面一个动作都没有」的
  const remaining = await getAll<Exercise>(Store.exercises);
  const muscleIdsInUse = new Set(remaining.map((exercise) => exercise.muscleId));

  for (const muscle of muscles) {
    if (defaultMuscleNames.has(muscle.name)) continue;
    if (muscleIdsInUse.has(muscle.id)) continue;
    await remove(Store.muscles, muscle.id);
  }
}

/** 每次打开 App 都会跑一遍，幂等 */
export async function syncDefaultData(): Promise<void> {
  await ensureDefaultsSeeded();

  const stored = await get<MetaRow>(Store.meta, SYNC_VERSION_KEY);
  const appliedVersion = Number(stored?.value ?? '0');
  if (Number.isFinite(appliedVersion) && appliedVersion >= SYNC_VERSION) {
    return;
  }

  await mergeMissingDefaults();
  await removeStaleDefaults();
  await put(Store.meta, {
    key: SYNC_VERSION_KEY,
    value: String(SYNC_VERSION),
  } satisfies MetaRow);
}
