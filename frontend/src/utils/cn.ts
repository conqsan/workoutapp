/** 极简 className 拼接，避免为了一个函数引入额外依赖。 */
export function cn(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}
