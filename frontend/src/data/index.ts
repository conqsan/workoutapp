import { createLocalRepository } from './localRepository';
import { syncDefaultData } from './syncDefaults';
import type { FitLogRepository } from './types';

/**
 * 数据层入口。
 *
 * UI 只从这里拿 repository，不直接 import 具体实现 ——
 * Phase 8 加 HTTP 实现 / 同步时，页面代码不需要改。
 */
export const repository: FitLogRepository = createLocalRepository();

let readyPromise: Promise<void> | null = null;

/**
 * 第一次使用前调用一次。
 * 除了首次写入，也会把 shared/defaults 的增删同步到本机（详见 syncDefaults.ts）。
 */
export function initDataLayer(): Promise<void> {
  readyPromise ??= syncDefaultData();
  return readyPromise;
}

/**
 * 备份 / 恢复用到的纯函数与常量。
 * UI 只依赖这些，不关心它们背后是 IndexedDB 还是别的实现。
 */
export {
  APP_VERSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  countBackup,
  describeCounts,
  describeImportResult,
  parseBackupText,
  serializeWorkoutSetsCsv,
  toBackupJson,
} from './backup';
export type {
  BackupCounts,
  BackupData,
  BackupSnapshot,
  ImportResult,
  ValidationResult,
} from './backup';

export type * from './types';
