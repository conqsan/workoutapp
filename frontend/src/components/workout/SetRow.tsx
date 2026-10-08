import { useEffect, useState, type ReactElement } from 'react';
import { QuickWeightButtons } from './QuickWeightButtons';
import type { WeightUnit, WorkoutSet, WorkoutSetPatch } from '@/data';
import { cn } from '@/utils/cn';
import {
  WEIGHT_UNITS,
  formatWeightValue,
  fromKilograms,
  roundWeight,
  toKilograms,
} from '@/utils/weight';

export interface SetRowProps {
  set: WorkoutSet;
  disabled: boolean;
  onUpdate: (id: string, patch: WorkoutSetPatch) => void;
  onRemove: (id: string) => void;
}

/**
 * 一组训练的录入行。
 *
 * 布局刻意压到三行：状态 / 三个输入框 / 快捷重量。备注和删除是低频操作，
 * 收在「⋯」里，平时不占高度 —— 一次训练动辄十几组，每行省一截就很可观。
 *
 * 输入框用「本地 state + 失焦提交」：打字过程中不会一直写数据库，
 * 点到别处（包括点「完成」「添加一组」）时自动保存，兼顾速度与可靠性。
 */
export function SetRow({ set, disabled, onUpdate, onRemove }: SetRowProps): ReactElement {
  const [weight, setWeight] = useState(formatWeightValue(set.weight));
  const [reps, setReps] = useState(String(set.reps));
  const [rest, setRest] = useState(set.restSeconds === null ? '' : String(set.restSeconds));
  const [note, setNote] = useState(set.note);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // 外部数据变了（比如点了「复制上一组」或切换了单位）要同步回输入框
  useEffect(() => setWeight(formatWeightValue(set.weight)), [set.weight, set.weightUnit]);
  useEffect(() => setReps(String(set.reps)), [set.reps]);
  useEffect(
    () => setRest(set.restSeconds === null ? '' : String(set.restSeconds)),
    [set.restSeconds],
  );
  useEffect(() => setNote(set.note), [set.note]);

  const commitNumbers = (): void => {
    const parsedWeight = Number(weight);
    const parsedReps = Number(reps);
    const patch: WorkoutSetPatch = {};

    if (Number.isFinite(parsedWeight) && parsedWeight >= 0 && parsedWeight !== set.weight) {
      patch.weight = roundWeight(parsedWeight);
    }
    if (Number.isInteger(parsedReps) && parsedReps > 0 && parsedReps !== set.reps) {
      patch.reps = parsedReps;
    }

    if (Object.keys(patch).length > 0) {
      onUpdate(set.id, patch);
      return;
    }

    // 输入不合法就还原成已保存的值，不让用户看到假数据
    setWeight(formatWeightValue(set.weight));
    setReps(String(set.reps));
  };

  const commitRest = (): void => {
    if (rest.trim() === '') {
      if (set.restSeconds !== null) onUpdate(set.id, { restSeconds: null });
      return;
    }
    const parsed = Number(rest);
    if (Number.isInteger(parsed) && parsed >= 0) {
      if (parsed !== set.restSeconds) onUpdate(set.id, { restSeconds: parsed });
      return;
    }
    setRest(set.restSeconds === null ? '' : String(set.restSeconds));
  };

  const adjustWeight = (delta: number): void => {
    const next = roundWeight((Number(weight) || 0) + delta);
    setWeight(formatWeightValue(next));
    onUpdate(set.id, { weight: next });
  };

  /**
   * 切换单位时**换算数值**，而不是把数字原样换个标签。
   * 80kg 换成磅应该显示 176.4，因为实际举起来的重量没有变。
   */
  const changeUnit = (nextUnit: WeightUnit): void => {
    if (nextUnit === set.weightUnit) return;

    const kilograms = toKilograms(Number(weight) || 0, set.weightUnit);
    const converted = roundWeight(fromKilograms(kilograms, nextUnit));

    setWeight(formatWeightValue(converted));
    onUpdate(set.id, { weight: converted, weightUnit: nextUnit });
  };

  const commitNote = (): void => {
    if (note !== set.note) onUpdate(set.id, { note });
  };

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200" data-testid="set-row">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold',
              set.completed ? 'text-brand-700' : 'text-slate-700',
            )}
          >
            第 {set.setNumber} 组
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onUpdate(set.id, { completed: !set.completed })}
            data-testid="set-done"
            className={cn(
              'min-h-[30px] rounded-full px-3 text-xs font-semibold transition disabled:opacity-50',
              set.completed
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-500 ring-1 ring-slate-300',
            )}
          >
            {set.completed ? '✓ 已完成' : '完成'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-label="更多"
          data-testid="set-more"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg text-base leading-none transition',
            moreOpen || set.note ? 'text-brand-600' : 'text-slate-400',
          )}
        >
          ⋯
        </button>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-slate-500">重量</span>
            <span
              className="flex overflow-hidden rounded-md ring-1 ring-slate-300"
              role="group"
              aria-label="重量单位"
            >
              {WEIGHT_UNITS.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  disabled={disabled}
                  data-testid="weight-unit"
                  data-unit={unit}
                  onClick={() => changeUnit(unit)}
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-semibold uppercase transition disabled:opacity-50',
                    unit === set.weightUnit ? 'bg-brand-600 text-white' : 'bg-white text-slate-500',
                  )}
                >
                  {unit}
                </button>
              ))}
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="重量"
            data-testid="set-weight"
            value={weight}
            disabled={disabled}
            onChange={(event) => setWeight(event.target.value)}
            onBlur={commitNumbers}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="field h-12 px-2 text-center text-lg font-semibold"
          />
        </div>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">次数</span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            data-testid="set-reps"
            value={reps}
            disabled={disabled}
            onChange={(event) => setReps(event.target.value)}
            onBlur={commitNumbers}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="field h-12 px-2 text-center text-lg font-semibold"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">休息 (秒)</span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            value={rest}
            disabled={disabled}
            onChange={(event) => setRest(event.target.value)}
            onBlur={commitRest}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            placeholder="—"
            className="field h-12 px-2 text-center text-lg font-semibold"
          />
        </label>
      </div>

      <div className="mt-2">
        <QuickWeightButtons onAdjust={adjustWeight} disabled={disabled} />
      </div>

      {moreOpen ? (
        <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
          <input
            type="text"
            value={note}
            disabled={disabled}
            placeholder="这一组的备注（可留空）"
            onChange={(event) => setNote(event.target.value)}
            onBlur={commitNote}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="field h-11 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            {confirmRemove ? (
              <>
                <span className="text-xs text-rose-600">确定删除这一组？</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemove(set.id)}
                    data-testid="confirm-remove-set"
                    className="min-h-[32px] rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white"
                  >
                    删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="min-h-[32px] rounded-lg px-3 text-xs font-medium text-slate-500"
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setConfirmRemove(true)}
                data-testid="remove-set"
                className="min-h-[32px] text-xs font-medium text-rose-500 disabled:opacity-50"
              >
                删除这一组
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
