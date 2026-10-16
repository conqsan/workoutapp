import exercisesJson from '@shared/defaults/exercises.json';
import musclesJson from '@shared/defaults/muscles.json';
import supplementsJson from '@shared/defaults/supplements.json';
import { getAll, get, put, remove, Store, type MetaRow } from './db';
import {
  ensureDefaultsSeeded,
  normalizeMediaRef,
  normalizeUnits,
  normalizeWeightSlots,
} from './defaults';
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
  /** 一组显示几个重量框（递减组 > 1），不写就是 1 */
  weightSlots?: number;
  /** 示范图编号（Exercises Dataset 的 id），不写就是没有示范图 */
  ref?: string;
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
/**
 * **只管增 / 删**：往 shared/defaults 里加或删默认项时 +1，老用户下次打开才同步到。
 * 改已有条目的字段（动作的 weightSlots / ref、补剂的 units）**不用动它** ——
 * 那些由 reconcileDefaultFields / 补剂合并逻辑每次打开对齐。
 */
const SYNC_VERSION = 6;

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

/**
 * 把「归 JSON 管」的字段对齐到本机 —— 目前是动作的 weightSlots 与示范图编号。
 *
 * 为什么必须每次打开都跑，不能挂在 SYNC_VERSION 上：
 * 那个版本号管的是**增 / 删**（它的作用是别把用户特意删掉的默认项又加回来），
 * 而「改一个已有动作的 ref / 段数」根本不改版本号 —— 于是 JSON 改了，
 * 手机却永远停在旧值。换示范图踩过这个坑，所以这里单独拆出来。
 *
 * 安全性来自它只做一件事：更新**已经存在**的默认动作，不新建、不删除。
 * 自定义动作一律不碰。
 */
async function reconcileDefaultFields(): Promise<void> {
  const [muscles, exercises] = await Promise.all([
    getAll<Muscle>(Store.muscles),
    getAll<Exercise>(Store.exercises),
  ]);

  const muscleNameById = new Map(muscles.map((muscle) => [muscle.id, muscle.name]));
  const byKey = new Map<string, Exercise>();
  for (const exercise of exercises) {
    if (exercise.isCustom) continue;
    byKey.set(exerciseKey(muscleNameById.get(exercise.muscleId) ?? '', exercise.name), exercise);
  }

  let patched = 0;
  for (const seed of exerciseSeeds) {
    const existing = byKey.get(exerciseKey(seed.muscle, seed.name));
    if (!existing) continue;

    const patch: { weightSlots?: number; mediaRef?: string | null } = {};
    const slots = normalizeWeightSlots(seed);
    const mediaRef = normalizeMediaRef(seed);
    // 老设备上的动作可能没有 weightSlots / mediaRef（v4、v6 之前），一并补齐
    if (normalizeWeightSlots(existing) !== slots) patch.weightSlots = slots;
    if ((existing.mediaRef ?? null) !== mediaRef) patch.mediaRef = mediaRef;
    if (Object.keys(patch).length === 0) continue;

    await put(Store.exercises, { ...existing, ...patch });
    patched += 1;
  }

  if (patched > 0) {
    console.info(`[FitLog] 已把 ${patched} 个默认动作对齐到 shared/defaults`);
  }
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
  const exerciseByKey = new Map(
    exercises.map((exercise) => [
      exerciseKey(muscleNameById.get(exercise.muscleId) ?? '', exercise.name),
      exercise,
    ]),
  );

  for (const [index, seed] of exerciseSeeds.entries()) {
    const slots = normalizeWeightSlots(seed);
    const mediaRef = normalizeMediaRef(seed);
    const existing = exerciseByKey.get(exerciseKey(seed.muscle, seed.name));

    // 已有的默认动作不在这里改 —— 字段对齐是 reconcileDefaultFields 的活，它每次打开都跑
    if (existing) continue;

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
      weightSlots: slots,
      mediaRef,
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

  // 字段对齐每次打开都跑：只更新已存在的默认动作，不增不删，所以安全
  await reconcileDefaultFields();

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
