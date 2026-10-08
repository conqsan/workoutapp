import exercisesJson from '@shared/defaults/exercises.json';
import musclesJson from '@shared/defaults/muscles.json';
import supplementsJson from '@shared/defaults/supplements.json';
import { count, get, put, putMany, Store, type MetaRow } from './db';
import type { Exercise, Muscle, Supplement } from './types';

/**
 * 默认数据的本地初始化。
 *
 * 数据来源是仓库根目录的 shared/defaults —— 和后端 seed 读的是同一份 JSON，
 * 所以「胸 / 背 / 肩」这些永远只有一处定义。
 *
 * 打包进前端是本地优先架构的必然结果：手机第一次打开、又没有网络时，
 * 也必须能把训练部位列出来。
 */

const SEEDED_FLAG = 'defaults-seeded-v1';

export const DEFAULT_MUSCLES: readonly Muscle[] = musclesJson.map((muscle, index) => ({
  id: `m${index + 1}`,
  name: muscle.name,
  sortOrder: muscle.sortOrder,
}));

const muscleIdByName = new Map(DEFAULT_MUSCLES.map((muscle) => [muscle.name, muscle.id]));

export const DEFAULT_EXERCISES: readonly Exercise[] = exercisesJson.map((exercise, index) => {
  const muscleId = muscleIdByName.get(exercise.muscle);
  if (muscleId === undefined) {
    throw new Error(
      `默认动作「${exercise.name}」引用了不存在的训练部位「${exercise.muscle}」，请检查 shared/defaults。`,
    );
  }
  return {
    id: `e${index + 1}`,
    name: exercise.name,
    muscleId,
    description: null,
    isCustom: false,
    sortOrder: index,
  };
});

/**
 * 补剂允许的单位：`units` 是 v4 才加的字段，老数据 / 老备份没有它，按原来的单位兜底。
 */
export function normalizeUnits(supplement: {
  unit: string;
  units?: readonly string[] | undefined;
}): string[] {
  const units = (supplement.units ?? [])
    .map((unit) => unit.trim())
    .filter((unit) => unit.length > 0);
  return units.length > 0 ? units : [supplement.unit];
}

export const DEFAULT_SUPPLEMENTS: readonly Supplement[] = supplementsJson.map(
  (supplement, index) => ({
    id: `sup${index + 1}`,
    name: supplement.name,
    unit: supplement.unit,
    units: normalizeUnits(supplement),
    isDefault: true,
    sortOrder: index,
  }),
);

/**
 * 只在需要时写入默认数据。
 * 用 meta 里的标记 + 空表判断双保险：既不会重复写入，也不会覆盖用户自己加的动作。
 */
export async function ensureDefaultsSeeded(): Promise<void> {
  const seeded = await get<MetaRow>(Store.meta, SEEDED_FLAG);
  if (seeded?.value === 'yes') {
    return;
  }

  if ((await count(Store.muscles)) === 0) {
    await putMany(Store.muscles, DEFAULT_MUSCLES);
  }
  if ((await count(Store.exercises)) === 0) {
    await putMany(Store.exercises, DEFAULT_EXERCISES);
  }
  if ((await count(Store.supplements)) === 0) {
    await putMany(Store.supplements, DEFAULT_SUPPLEMENTS);
  }

  await put(Store.meta, { key: SEEDED_FLAG, value: 'yes' } satisfies MetaRow);
}
