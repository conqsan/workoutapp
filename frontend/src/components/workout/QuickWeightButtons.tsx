import type { ReactElement } from 'react';

/** 需求里指定的快捷重量调整档位。只是快捷方式，输入框仍然可以直接输入任意数值。 */
const WEIGHT_STEPS = [-5, -2.5, -1, 1, 2.5, 5] as const;

export interface QuickWeightButtonsProps {
  onAdjust: (delta: number) => void;
  disabled?: boolean;
}

function label(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

export function QuickWeightButtons({ onAdjust, disabled }: QuickWeightButtonsProps): ReactElement {
  return (
    <div className="grid grid-cols-6 gap-1">
      {WEIGHT_STEPS.map((delta) => (
        <button
          key={delta}
          type="button"
          disabled={disabled}
          onClick={() => onAdjust(delta)}
          className="min-h-[36px] rounded-lg bg-white text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-40"
        >
          {label(delta)}
        </button>
      ))}
    </div>
  );
}
