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

/** 训练总量：把每一组都换算成 kg 之后再求和 */
export function calculateTotalVolumeKg(
  sets: ReadonlyArray<{ weight: number; reps: number; weightUnit: WeightUnit }>,
): number {
  return sets.reduce((total, set) => total + toKilograms(set.weight, set.weightUnit) * set.reps, 0);
}
