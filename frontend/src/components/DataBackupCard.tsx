import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  countBackup,
  describeCounts,
  describeImportResult,
  parseBackupText,
  repository,
  serializeWorkoutSetsCsv,
  toBackupJson,
} from '@/data';
import { todayKey } from '@/data/ids';
import { cn } from '@/utils/cn';
import { downloadTextFile } from '@/utils/download';

type StatusKind = 'busy' | 'ok' | 'error';

interface Status {
  kind: StatusKind;
  message: string;
  details: string[];
}

const STATUS_CLASS: Record<StatusKind, string> = {
  busy: 'bg-slate-100 text-slate-600',
  ok: 'bg-brand-50 text-brand-800',
  error: 'bg-rose-50 text-rose-700',
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : '未知错误';
}

/**
 * 数据备份 / 恢复卡片（「我的」页）。
 *
 * 走本地优先架构之后，导出 / 导入是**唯一**能完整找回数据的路径（见 ADR 0001），
 * 所以这里的设计重点是：一眼看懂数据在哪、怎么备份，导入失败时说得清**哪里不对**。
 */
export function DataBackupCard(): ReactElement {
  const [status, setStatus] = useState<Status | null>(null);
  const [overview, setOverview] = useState('读取中…');
  /** 导入成功后 +1，让上面的数据概览重新读一次 */
  const [overviewToken, setOverviewToken] = useState(0);

  const busy = status?.kind === 'busy';

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [summaries, supplements] = await Promise.all([
          repository.listWorkoutSummaries(),
          repository.listSupplements(),
        ]);
        if (cancelled) return;

        const sets = summaries.reduce((total, item) => total + item.setCount, 0);
        setOverview(`${summaries.length} 次训练 · ${sets} 组 · ${supplements.length} 种补剂`);
      } catch (error) {
        if (!cancelled) setOverview(`读取失败：${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overviewToken]);

  const handleExportJson = async (): Promise<void> => {
    setStatus({ kind: 'busy', message: '正在打包…', details: [] });
    try {
      const snapshot = await repository.exportBackup();
      downloadTextFile(
        `fitlog-backup-${todayKey()}.json`,
        toBackupJson(snapshot),
        'application/json',
      );
      setStatus({
        kind: 'ok',
        message: `已导出完整备份（${describeCounts(countBackup(snapshot.data))}）。`,
        details: ['文件已下载到本机。备份是唯一的数据保险，建议存到网盘或发给自己。'],
      });
    } catch (error) {
      setStatus({ kind: 'error', message: `导出失败：${errorMessage(error)}`, details: [] });
    }
  };

  const handleExportCsv = async (): Promise<void> => {
    setStatus({ kind: 'busy', message: '正在生成 CSV…', details: [] });
    try {
      const workouts = await repository.listWorkouts();
      if (workouts.length === 0) {
        setStatus({
          kind: 'error',
          message: '还没有任何训练记录，先记一次训练再导出 CSV。',
          details: [],
        });
        return;
      }

      const sets = workouts.reduce((total, workout) => total + workout.totalSets, 0);
      downloadTextFile(
        `fitlog-sets-${todayKey()}.csv`,
        serializeWorkoutSetsCsv(workouts),
        'text/csv',
      );
      setStatus({
        kind: 'ok',
        message: `已导出 CSV：${workouts.length} 次训练、${sets} 组明细。`,
        details: ['一行 = 一组；重量额外给了换算后的 kg 列，可以按部位或动作直接透视。'],
      });
    } catch (error) {
      setStatus({ kind: 'error', message: `导出失败：${errorMessage(error)}`, details: [] });
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    // 先清空，这样同一个文件改完再选一次也会触发 change
    event.target.value = '';
    if (!file) return;

    setStatus({ kind: 'busy', message: `正在读取 ${file.name}…`, details: [] });

    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      setStatus({ kind: 'error', message: `读不到这个文件：${errorMessage(error)}`, details: [] });
      return;
    }

    const parsed = parseBackupText(text);
    if (!parsed.ok) {
      setStatus({
        kind: 'error',
        message: '这个文件不是有效的 FitLog 备份，没有导入任何数据。',
        details: parsed.errors,
      });
      return;
    }

    try {
      const result = await repository.importBackup(parsed.snapshot);
      const details = describeImportResult(result);

      if (result.warnings.length > 0) {
        details.push(...result.warnings);
      }

      setStatus({
        kind: 'ok',
        message:
          result.addedTotal === 0
            ? '本机已经有这些数据，没有需要新增的内容。'
            : `已导入 ${result.addedTotal} 条记录。`,
        details,
      });
      setOverviewToken((token) => token + 1);
    } catch (error) {
      setStatus({ kind: 'error', message: `导入失败：${errorMessage(error)}`, details: [] });
    }
  };

  return (
    <section className="card space-y-3" data-testid="backup-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="shrink-0 text-base font-semibold text-slate-900">数据备份</h2>
        <span className="min-w-0 truncate text-xs text-slate-400" data-testid="data-overview">
          {overview}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-slate-600">
        训练和补剂都存在这台设备的 IndexedDB
        里，不依赖服务器。换手机、换浏览器或者清理站点数据都会丢， 所以{' '}
        <span className="font-medium text-slate-800">导出 JSON 是唯一能完整找回数据的办法</span>
        ，建议隔一段时间导出一份。
      </p>

      <div className="grid gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleExportJson()}
          data-testid="export-json"
          className="btn btn-primary h-12 text-sm"
        >
          导出 JSON（完整备份）
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleExportCsv()}
          data-testid="export-csv"
          className="btn btn-secondary h-12 text-sm"
        >
          导出 CSV（训练组明细）
        </button>

        <label
          className={cn(
            'btn btn-secondary h-12 cursor-pointer text-sm',
            busy && 'pointer-events-none opacity-50',
          )}
          data-testid="import-button"
        >
          导入 JSON（合并到本机）
          <input
            type="file"
            accept=".json,application/json"
            data-testid="import-file"
            className="hidden"
            disabled={busy}
            onChange={(event) => void handleImportFile(event)}
          />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        导入是
        <span className="font-medium text-slate-500">合并</span>
        ：只补本机没有的，重复的自动跳过，本机已有的记录不会被覆盖。
      </p>

      {status ? (
        <div
          data-testid="backup-status"
          data-kind={status.kind}
          className={cn('rounded-xl px-3 py-2', STATUS_CLASS[status.kind])}
        >
          <p className="text-sm font-medium">{status.message}</p>
          {status.details.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed">
              {status.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
