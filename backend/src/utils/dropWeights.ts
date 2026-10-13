/**
 * 递减组的后续段重量在 SQLite 里存 JSON 数组字符串。
 *
 * 和 supplementUnits 一样，读的时候要扛得住脏数据：单位 / 重量只是数字，
 * 存坏了就当作「没有后续段」，不能让一个坏字段把整个训练接口打成 500。
 */

const MAX_DROPS = 2;

export function parseDropWeights(raw: string | null | undefined): number[] {
  if (raw === null || raw === undefined || raw.trim() === '') return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is number => typeof item === 'number')
        .filter((item) => Number.isFinite(item) && item >= 0)
        .slice(0, MAX_DROPS);
    }
  } catch {
    // 存坏了就当作没有后续段
  }

  return [];
}

export function serializeDropWeights(values: readonly number[] | undefined): string {
  if (values === undefined) return '[]';

  const list = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice(0, MAX_DROPS)
    .map((value) => Math.round(value * 100) / 100);

  return JSON.stringify(list);
}

/** 递减组后续段各自的次数（正整数） */
export function parseDropReps(raw: string | null | undefined): number[] {
  if (raw === null || raw === undefined || raw.trim() === '') return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is number => typeof item === 'number')
        .filter((item) => Number.isInteger(item) && item > 0)
        .slice(0, MAX_DROPS);
    }
  } catch {
    // 存坏了就当作没有后续段次数（读的时候按整组的次数兜底）
  }

  return [];
}

export function serializeDropReps(values: readonly number[] | undefined): string {
  if (values === undefined) return '[]';

  const list = values.filter((value) => Number.isInteger(value) && value > 0).slice(0, MAX_DROPS);

  return JSON.stringify(list);
}
