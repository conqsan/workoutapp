export type WeightUnit = 'kg' | 'lb';

export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

/** 1 磅 = 0.45359237 千克（精确值） */
export const KG_PER_LB = 0.45359237;

export function toKilograms(weight: number, unit: WeightUnit): number {
  return unit === 'kg' ? weight : weight * KG_PER_LB;
}

/**
 * 训练总量。
 * 混着 kg / lb 的组不能直接相加 —— 一律先换算成 kg，保证统计口径一致。
 */
export function calculateTotalVolumeKg(
  sets: ReadonlyArray<{ weight: number; reps: number; weightUnit: WeightUnit }>,
): number {
  return sets.reduce((total, set) => total + toKilograms(set.weight, set.weightUnit) * set.reps, 0);
}
