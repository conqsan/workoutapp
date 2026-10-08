import type { ReactElement } from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  testId?: string;
}

export function StatCard({ label, value, hint, testId }: StatCardProps): ReactElement {
  return (
    <div className="card flex flex-col justify-between gap-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900" data-testid={testId}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}
