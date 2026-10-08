import type { ReactElement } from 'react';

export interface PhasePlaceholderProps {
  phase: string;
  description: string;
  items: readonly string[];
}

/**
 * Phase 1 占位卡片：明确标注该功能属于哪个 Phase，避免误以为已经实现。
 */
export function PhasePlaceholder({
  phase,
  description,
  items,
}: PhasePlaceholderProps): ReactElement {
  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          {phase}
        </span>
        <span className="text-xs font-medium text-slate-400">待实现</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{description}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
