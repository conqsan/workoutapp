/**
 * 本地时区的 'YYYY-MM-DD'。
 * 不要用 toISOString() —— 那是 UTC，晚上训练会被算到第二天。
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
