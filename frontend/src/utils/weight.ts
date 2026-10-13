export type WeightUnit = 'kg' | 'lb';

export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

/** 1 磅 = 0.45359237 千克（精确值） */
export const KG_PER_LB = 0.45359237;

/**
 * 统一到千克。
 * 统计口径（训练总量、重量趋势、最大重量）一律用 kg，避免 kg / lb 混在一起加总。
 */
export function toKilograms(weight: number, unit: WeightUnit): number {
  return unit === 'kg' ? weight : weight * KG_PER_LB;
}

export function fromKilograms(kilograms: number, unit: WeightUnit): number {
  return unit === 'kg' ? kilograms : kilograms / KG_PER_LB;
}

/** 重量保留两位小数，避免 80.30000000000001 这种浮点尾巴 */
export function roundWeight(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

/** 80 -> "80"，80.5 -> "80.5" */
export function formatWeightValue(value: number): string {
  const rounded = roundWeight(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatWeight(weight: number, unit: WeightUnit): string {
  return `${formatWeightValue(weight)}${unit}`;
}

/**
 * 一组里所有重量段（递减组会有多段）。
 * 老数据 / 普通动作没有 dropWeights，按单段兜底。
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
 *
 * dropReps 与 dropWeights 一一对应；**v6 之前的递减组没有 dropReps**（那时次数是整组一份），
 * 这些老数据按这一组自己的 reps 兜底，保证历史数字不变。
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

/**
 * 一组的训练量（kg）：**各段重量分别换算成 kg 再乘以次数**后相加。
 * 递减组 20kg×10 → 15kg×8 → 10kg×6，这一组的量就是 200 + 120 + 60 = 380kg。
 */
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

/** 一组里的最大重量（kg）——递减组取最大的那一段 */
export function maxSetWeightKg(set: {
  weight: number;
  dropWeights?: readonly number[] | undefined;
  weightUnit: WeightUnit;
}): number {
  return setSegmentWeights(set).reduce(
    (max, weight) => Math.max(max, toKilograms(weight, set.weightUnit)),
    0,
  );
}

/** 训练总量：把每一组的每一段都换算成 kg 之后再求和 */
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
