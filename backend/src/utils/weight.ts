export type WeightUnit = 'kg' | 'lb';

export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

/** 1 磅 = 0.45359237 千克（精确值） */
export const KG_PER_LB = 0.45359237;

export function toKilograms(weight: number, unit: WeightUnit): number {
  return unit === 'kg' ? weight : weight * KG_PER_LB;
}

/**
 * 一组里的所有重量段（递减组会有多段）。
 * 后续段存在 dropWeights 里，普通动作是空数组。
 */
export function setSegmentWeights(set: {
  weight: number;
  dropWeights?: readonly number[] | undefined;
}): number[] {
  const drops = (set.dropWeights ?? []).filter(
    (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  );
  return [set.weight, ...drops];
}

export interface SetSegment {
  weight: number;
  reps: number;
}

/**
 * 把一组拆成「段」：普通动作 1 段，递减组 2～3 段，每段各有自己的重量与次数。
 * v6 之前的递减组没有 dropReps（那时次数是整组一份），按这一组的 reps 兜底。
 */
export function setSegments(set: {
  weight: number;
  reps: number;
  dropWeights?: readonly number[] | undefined;
  dropReps?: readonly number[] | undefined;
}): SetSegment[] {
  const drops = set.dropWeights ?? [];
  const dropReps = set.dropReps ?? [];

  return [
    { weight: set.weight, reps: set.reps },
    ...drops.map((weight, index) => ({ weight, reps: dropReps[index] ?? set.reps })),
  ].filter((segment) => Number.isFinite(segment.weight) && segment.weight >= 0);
}

/** 一组的训练量（kg）：每一段分别换算成 kg 再乘以它自己的次数 */
export function calculateSetVolumeKg(set: {
  weight: number;
  reps: number;
  dropWeights?: readonly number[] | undefined;
  dropReps?: readonly number[] | undefined;
  weightUnit: WeightUnit;
}): number {
  return setSegments(set).reduce(
    (total, segment) => total + toKilograms(segment.weight, set.weightUnit) * segment.reps,
    0,
  );
}

/**
 * 训练总量。
 * 混着 kg / lb 的组不能直接相加 —— 一律先换算成 kg，保证统计口径一致。
 * 递减组把每一段都算进去。
 */
export function calculateTotalVolumeKg(
  sets: ReadonlyArray<{
    weight: number;
    dropWeights?: readonly number[] | undefined;
    reps: number;
    weightUnit: WeightUnit;
  }>,
): number {
  return sets.reduce((total, set) => total + calculateSetVolumeKg(set), 0);
}
