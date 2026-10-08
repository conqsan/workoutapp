import type { ReactElement } from 'react';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { cn } from '@/utils/cn';

const STATE_STYLES = {
  loading: { dot: 'bg-amber-400', text: 'text-amber-700', label: '检测中…' },
  online: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: '已连接' },
  offline: { dot: 'bg-rose-500', text: 'text-rose-700', label: '未连接' },
} as const;

/**
 * Phase 1 的前后端连通性检查卡片。
 * 后续 Phase 可以保留它用于排查「后端没启动」这类问题。
 */
export function BackendStatusCard(): ReactElement {
  const { state, data, errorMessage, refresh } = useBackendHealth();
  const style = STATE_STYLES[state];

  return (
    <section className="card space-y-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">后端连接</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', style.dot)} />
            <span className={cn('text-base font-semibold', style.text)}>{style.label}</span>
          </div>
        </div>
        <button type="button" className="btn btn-secondary h-10 px-3 text-sm" onClick={refresh}>
          重新检测
        </button>
      </div>

      {state === 'online' && data ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Detail label="服务" value={data.service} />
            <Detail label="版本" value={data.version} />
            <Detail label="环境" value={data.environment} />
            <Detail label="数据库" value={data.database.initialized ? '已就绪' : '未初始化'} />
          </dl>
          {data.database.initialized ? null : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {data.database.message ?? '数据库尚未初始化。'}
            </p>
          )}
        </div>
      ) : null}

      {state === 'offline' ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage ?? '无法连接服务器，请检查网络后重试。'}
        </p>
      ) : null}

      {state === 'loading' ? (
        <p className="text-sm text-slate-500">正在请求 GET /api/health …</p>
      ) : null}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="truncate font-medium text-slate-800">{value}</dd>
    </div>
  );
}
