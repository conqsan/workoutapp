import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useHistory } from '@/hooks/useHistory';
import { cn } from '@/utils/cn';
import { formatDateKeyShortWeekday, formatVolume, relativeDayLabel } from '@/utils/format';

export function HistoryPage(): ReactElement {
  const { loading, summaries, error } = useHistory();

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>;
  }

  if (summaries.length === 0) {
    return (
      <section className="card space-y-3 text-center">
        <p className="text-base font-semibold text-slate-900">还没有训练记录</p>
        <p className="text-sm text-slate-500">去训练页开始第一次吧。</p>
        <Link to="/workout" className="btn btn-primary h-12 w-full">
          开始训练
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-slate-400">共 {summaries.length} 次训练</p>

      {summaries.map((summary) => {
        const relative = relativeDayLabel(summary.date);
        return (
          <Link
            key={summary.id}
            to={`/history/${summary.id}`}
            data-testid="history-item"
            data-date={summary.date}
            className="card block transition active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  {formatDateKeyShortWeekday(summary.date)}
                  {relative ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      {relative}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-600">
                  {summary.muscleNames.length > 0 ? summary.muscleNames.join(' + ') : '未记录部位'}
                </p>
                {summary.note ? (
                  <p className="mt-0.5 truncate text-xs text-slate-400">{summary.note}</p>
                ) : null}
              </div>

              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-slate-900">
                  {formatVolume(summary.totalVolume)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {summary.exerciseCount} 个动作 · {summary.setCount} 组
                </p>
              </div>
            </div>

            {summary.status === 'active' ? (
              <p
                className={cn(
                  'mt-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700',
                )}
              >
                进行中
              </p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
