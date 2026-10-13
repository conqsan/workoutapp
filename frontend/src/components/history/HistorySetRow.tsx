import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { WorkoutSet, WorkoutSetPatch } from '@/data';
import { cn } from '@/utils/cn';
import {
  formatSetSummary,
  parseSegmentInputs,
  requiredSlotCount,
  repsInputValues,
  segmentCount,
  slotCount,
  storedSegmentsKey,
  weightInputValues,
} from '@/utils/setWeights';

export interface HistorySetRowProps {
  set: WorkoutSet;
  /** 这个动作一组显示几个重量框（递减组是 3） */
  weightSlots: number;
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
  weightSlots,
  disabled,
  onUpdate,
  onRemove,
}: HistorySetRowProps): ReactElement {
  const slots = Math.max(slotCount(weightSlots), segmentCount(set));
  const required = requiredSlotCount(weightSlots);
  const [editing, setEditing] = useState(false);
  const [weightInputs, setWeightInputs] = useState<string[]>(() => weightInputValues(set, slots));
  const [repsInputs, setRepsInputs] = useState<string[]>(() => repsInputValues(set, slots));
  const [weightError, setWeightError] = useState<string | null>(null);
  const [rest, setRest] = useState(set.restSeconds === null ? '' : String(set.restSeconds));
  const [confirmRemove, setConfirmRemove] = useState(false);

  /**
   * 重量输入框只在「存下来的重量」变化时同步（不重挂组件，避免手机上丢焦点）；
   * 次数与休息各自同步。
   */
  const storedRef = useRef(set);
  storedRef.current = set;
  const storedKey = storedSegmentsKey(set);
  useEffect(() => {
    setWeightInputs(weightInputValues(storedRef.current, slots));
    setRepsInputs(repsInputValues(storedRef.current, slots));
    setWeightError(null);
  }, [storedKey, slots]);

  useEffect(() => {
    setRest(set.restSeconds === null ? '' : String(set.restSeconds));
  }, [set.restSeconds]);

  const save = (): void => {
    const parsed = parseSegmentInputs(weightInputs, repsInputs, slots);
    if (!parsed.ok) {
      // 还差另一半就只提示、保留输入；填的本身不合法才还原
      setWeightError(parsed.message);
      if (parsed.kind === 'invalid') {
        setWeightInputs(weightInputValues(set, slots));
        setRepsInputs(repsInputValues(set, slots));
      }
      return;
    }
    setWeightError(null);

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
    onUpdate(set.id, {
      weight: parsed.weight,
      reps: parsed.reps,
      dropWeights: parsed.dropWeights,
      dropReps: parsed.dropReps,
      restSeconds,
    });
  };

  return (
    <li className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm" data-testid="history-set">
      {editing ? (
        <div className="space-y-2 py-1">
          <p className="text-xs font-semibold text-slate-500">第 {set.setNumber} 组</p>
          <div className="space-y-2">
            <div
              className={cn('grid gap-2', slots > 1 ? 'grid-cols-3' : 'grid-cols-1')}
              data-testid="edit-set-weights"
            >
              {Array.from({ length: slots }, (_, index) => (
                <div key={index} className="min-w-0 space-y-1">
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">
                    {slots > 1
                      ? `第 ${index + 1} 段(${set.weightUnit} / 次)${index < required ? ' *' : ''}`
                      : `重量(${set.weightUnit})`}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid={index === 0 ? 'edit-set-weight' : `edit-set-weight-${index + 1}`}
                    value={weightInputs[index] ?? ''}
                    onChange={(event) => {
                      const next = event.target.value;
                      setWeightInputs((current) =>
                        current.map((value, at) => (at === index ? next : value)),
                      );
                    }}
                    className="field h-11 text-center text-base font-semibold"
                  />
                  {slots > 1 ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      data-testid={index === 0 ? 'edit-set-reps' : `edit-set-reps-${index + 1}`}
                      placeholder="次数"
                      value={repsInputs[index] ?? ''}
                      onChange={(event) => {
                        const next = event.target.value;
                        setRepsInputs((current) =>
                          current.map((value, at) => (at === index ? next : value)),
                        );
                      }}
                      className="field h-11 text-center text-base font-semibold"
                    />
                  ) : null}
                </div>
              ))}
            </div>
            {weightError ? (
              <p className="text-[11px] text-rose-600" data-testid="edit-set-weight-error">
                {weightError}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {slots === 1 ? (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">次数</span>
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid="edit-set-reps"
                  value={repsInputs[0] ?? ''}
                  onChange={(event) => setRepsInputs([event.target.value])}
                  className="field h-11 text-center text-base font-semibold"
                />
              </label>
            ) : null}
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
            <span className="truncate font-medium text-slate-800">{formatSetSummary(set)}</span>
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
