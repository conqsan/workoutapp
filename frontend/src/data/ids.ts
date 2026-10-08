/**
 * 生成本地实体 id。
 *
 * 为什么要带 fallback：`crypto.randomUUID()` 只在安全上下文（HTTPS / localhost）
 * 可用。手机通过局域网 http://192.168.x.x 访问时它是不存在的 —— 而局域网调试
 * 恰恰是最常用的场景（Phase 8 之前的 `npm run dev:host`）。
 */
export function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) {
    return `${prefix}_${random}`;
  }

  const time = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}${noise}`;
}

/** 本地时区的 'YYYY-MM-DD'（不要用 toISOString，那是 UTC） */
export function todayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
