/**
 * 补剂的「可选单位」在数据库里是 JSON 字符串（SQLite 没有数组类型）。
 *
 * 收在这里的原因：读的时候必须能扛住脏数据（存坏了、老库是空字符串），
 * 不能让一个坏字段把接口打成 500 —— 单位只是展示用的可选值，兜底成单单位就够了。
 */

export function parseUnits(raw: string | null | undefined, fallbackUnit: string): string[] {
  if (raw === null || raw === undefined || raw.trim() === '') return [fallbackUnit];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const units = parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (units.length > 0) return Array.from(new Set(units));
    }
  } catch {
    // 存坏了就按默认单位兜底
  }

  return [fallbackUnit];
}

export function serializeUnits(units: readonly string[] | undefined, fallbackUnit: string): string {
  const list = (units ?? []).map((unit) => unit.trim()).filter((unit) => unit.length > 0);
  return JSON.stringify(Array.from(new Set(list.length > 0 ? list : [fallbackUnit])));
}
