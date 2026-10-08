import { ensureDefaultsSeeded } from './defaults';
import { createLocalRepository } from './localRepository';
import type { FitLogRepository } from './types';

/**
 * 数据层入口。
 *
 * UI 只从这里拿 repository，不直接 import 具体实现 ——
 * Phase 8 加 HTTP 实现 / 同步时，页面代码不需要改。
 */
export const repository: FitLogRepository = createLocalRepository();

let readyPromise: Promise<void> | null = null;

/** 第一次使用前调用一次：保证默认的部位 / 动作已经写入本地库 */
export function initDataLayer(): Promise<void> {
  readyPromise ??= ensureDefaultsSeeded();
  return readyPromise;
}

export type * from './types';
