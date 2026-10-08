const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 2026-10-06 -> 2026年10月6日 星期二 */
export function formatDateLabel(date: Date): string {
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`;
}

/**
 * 解析 'YYYY-MM-DD' 为本地时区的 Date。
 * 不要用 new Date('2026-10-06') —— 那会被当成 UTC 午夜，东八区会显示成前一天。
 */
function parseDateKey(dateKey: string): Date | null {
  const matched = DATE_KEY_PATTERN.exec(dateKey);
  if (!matched) return null;
  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** '2026-10-06' -> '2026年10月6日 星期二' */
export function formatDateKeyLabel(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  return parsed ? formatDateLabel(parsed) : dateKey;
}

/** '2026-10-06' -> '10月6日' */
export function formatDateKeyShort(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  return parsed ? `${parsed.getMonth() + 1}月${parsed.getDate()}日` : dateKey;
}

/** '2026-10-06' -> '10月6日 星期二' */
export function formatDateKeyShortWeekday(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return `${formatDateKeyShort(dateKey)} ${WEEKDAY_LABELS[parsed.getDay()] ?? ''}`.trim();
}

/** 相对今天：今天 / 昨天 / 前天，其余返回 null */
export function relativeDayLabel(dateKey: string): string | null {
  const today = new Date();
  if (dateKey === toDateKey(today)) return '今天';

  const offsets: Array<[number, string]> = [
    [1, '昨天'],
    [2, '前天'],
  ];

  for (const [offset, label] of offsets) {
    const probe = new Date(today);
    probe.setDate(today.getDate() - offset);
    if (dateKey === toDateKey(probe)) return label;
  }

  return null;
}

/** 本地时区的 YYYY-MM-DD，避免 toISOString() 造成的时区偏移。 */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 训练总量：每组 weight × reps 求和。 */
export function calculateVolume(sets: readonly { weight: number; reps: number }[]): number {
  return sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

export function formatVolume(volume: number): string {
  return `${Math.round(volume).toLocaleString('zh-CN')} kg`;
}
