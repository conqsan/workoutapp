/**
 * 归一化可选的文本字段。
 *
 * 语义区分很重要：
 *   undefined -> 调用方没有提供这个字段，更新时应当「保持原值」
 *   null / '' / 纯空白 -> 调用方明确要清空
 */
export function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
