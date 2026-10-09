import { useEffect, useState, type ReactElement } from 'react';
import type { WorkoutSet, WorkoutSetPatch } from '@/data';
import { formatWeight, roundWeight } from '@/utils/weight';

export interface HistorySetRowProps {
  set: WorkoutSet;
  disabled: boolean;
  onUpdate: (setId: string, patch: WorkoutSetPatch) => void;
  onRemove: (setId: string) => void;
}

/**
 * 历史详情里的一行「某一组」。
 *
 * 记错了要能改 —— 这是历史记录最容易出错的地方：重量点错一位、次数多按一下。
 * 所以每一行都能就地改成 重量 / 次数 / 休息，也能删掉这一组（删完组号自动压成 1..n，
 * 由数据层负责）。查看态刻意保持一行，不占高度。
 */
export function HistorySetRow({
  set,
  disabled,
  onUpdate,
  onRemove,
}: HistorySetRowProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(String(set.weight));
  const [reps, setReps] = useState(String(set.reps));
  const [rest, setRest] = useState(set.restSeconds === null ? '' : String(set.restSeconds));
  const [confirmRemove, setConfirmRemove] = useState(false);

  // 外部数据变了（保存成功后被数据层重算）就同步回输入框
  useEffect(() => {
    setWeight(String(set.weight));
    setReps(String(set.reps));
    setRest(set.restSeconds === null ? '' : String(set.restSeconds));
  }, [set.weight, set.reps, set.restSeconds]);

  const save = (): void => {
    const parsedWeight = Number(weight);
    const parsedReps = Number(reps);

    // 不合法就还原成已保存的值，不让用户看到假数据
    if (
      !Number.isFinite(parsedWeight) ||
      parsedWeight < 0 ||
      !Number.isInteger(parsedReps) ||
      parsedReps <= 0
    ) {
      setWeight(String(set.weight));
      setReps(String(set.reps));
      return;
    }

    const trimmedRest = rest.trim();
    let restSeconds: number | null = set.restSeconds;
    if (trimmedRest === '') {
      restSeconds = null;
    } else {
      const parsedRest = Number(trimmedRest);
      if (Number.isInteger(parsedRest) && parsedRest >= 0) restSeconds = parsedRest;
      else setRest(set.restSeconds === null ? '' : String(set.restSeconds));
    }

    setEditing(false);
    onUpdate(set.id, { weight: roundWeight(parsedWeight), reps: parsedReps, restSeconds });
  };

  return (
    <li className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm" data-testid="history-set">
      {editing ? (
        <div className="space-y-2 py-1">
          <p className="text-xs font-semibold text-slate-500">第 {set.setNumber} 组</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">
                重量({set.weightUnit})
              </span>
              <input
                type="text"
                inputMode="decimal"
                data-testid="edit-set-weight"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="field h-11 text-center text-base font-semibold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">次数</span>
              <input
                type="text"
                inputMode="numeric"
                data-testid="edit-set-reps"
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                className="field h-11 text-center text-base font-semibold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">休息(秒)</span>
              <input
                type="text"
                inputMode="numeric"
                data-testid="edit-set-rest"
                value={rest}
                placeholder="—"
                onChange={(event) => setRest(event.target.value)}
                className="field h-11 text-center text-base font-semibold"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={save}
              data-testid="save-set"
              className="btn btn-primary h-10 flex-1 text-sm"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-secondary h-10 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-slate-500">第 {set.setNumber} 组</span>
            <span className="truncate font-medium text-slate-800">
              {formatWeight(set.weight, set.weightUnit)} × {set.reps}
            </span>
            <span className="shrink-0 text-xs text-slate-400">
              {set.restSeconds === null ? '—' : `休息 ${set.restSeconds}s`}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEditing(true)}
              data-testid="edit-set"
              className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-brand-600 disabled:opacity-50"
            >
              改
            </button>
            {confirmRemove ? (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(set.id)}
                  data-testid="confirm-remove-set-history"
                  className="min-h-[32px] rounded-lg bg-rose-600 px-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  确认
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-slate-500"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setConfirmRemove(true)}
                data-testid="remove-set-history"
                className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-rose-500 disabled:opacity-50"
              >
                删
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
