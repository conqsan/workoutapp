import { useEffect, useRef, useState, type ReactElement } from 'react';
import { QuickWeightButtons } from './QuickWeightButtons';
import { RestTimer } from './RestTimer';
import type { WeightUnit, WorkoutSet, WorkoutSetPatch } from '@/data';
import { startRest } from '@/stores/restTimer';
import { cn } from '@/utils/cn';
import {
  WEIGHT_UNITS,
  formatWeightValue,
  fromKilograms,
  roundWeight,
  toKilograms,
} from '@/utils/weight';
import {
  parseSegmentInputs,
  requiredSlotCount,
  repsInputValues,
  segmentCount,
  slotCount,
  storedSegmentsKey,
  weightInputValues,
} from '@/utils/setWeights';

export interface SetRowProps {
  set: WorkoutSet;
  /** 动作名：休息计时器在页面顶部的常驻条上要显示它是哪个动作 */
  exerciseName: string;
  /** 这个动作一组显示几个重量框（递减组是 3） */
  weightSlots: number;
  disabled: boolean;
  onUpdate: (id: string, patch: WorkoutSetPatch) => void;
  onRemove: (id: string) => void;
}

/**
 * 一组训练的录入行。
 *
 * 布局刻意压到几行：状态 / 重量与次数 / 快捷重量。备注和删除是低频操作，
 * 收在「⋯」里，平时不占高度 —— 一次训练动辄十几组，每行省一截就很可观。
 *
 * 递减组（weightSlots = 3）每一段都有自己的重量与次数（20kg×10 → 15kg×8 → 10kg×6）：
 * 前两段必填、第 3 段可选；休息仍然是整组一份。
 *
 * 输入框用「本地 state + 失焦提交」：打字过程中不会一直写数据库，
 * 点到别处（包括点「完成」「添加一组」）时自动保存，兼顾速度与可靠性。
 */
export function SetRow({
  set,
  exerciseName,
  weightSlots,
  disabled,
  onUpdate,
  onRemove,
}: SetRowProps): ReactElement {
  // 动作说要几个框就几个框；但已经在数据里的段必须显示出来，不能把老数据藏掉
  const slots = Math.max(slotCount(weightSlots), segmentCount(set));
  const required = requiredSlotCount(weightSlots);
  const [weightInputs, setWeightInputs] = useState<string[]>(() => weightInputValues(set, slots));
  const [repsInputs, setRepsInputs] = useState<string[]>(() => repsInputValues(set, slots));
  const [weightError, setWeightError] = useState<string | null>(null);
  const [note, setNote] = useState(set.note);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  /**
   * 重量输入框：本地 state + 失焦提交。
   * 只有「存下来的重量」真的变了（自己提交完、或点了「复制上一组」）才同步回输入框，
   * 而且**不重挂组件** —— 否则从重量切到次数时输入框会被换掉，手机上焦点会飞走。
   */
  const storedRef = useRef(set);
  storedRef.current = set;
  const storedKey = storedSegmentsKey(set);
  useEffect(() => {
    setWeightInputs(weightInputValues(storedRef.current, slots));
    setRepsInputs(repsInputValues(storedRef.current, slots));
    setWeightError(null);
  }, [storedKey, slots]);

  // 备注另外同步（次数跟着上面的段一起同步；休息时长由 RestTimer 自己管）
  useEffect(() => setNote(set.note), [set.note]);

  const commitNumbers = (): void => {
    const patch: WorkoutSetPatch = {};

    const parsed = parseSegmentInputs(weightInputs, repsInputs, slots);
    if (!parsed.ok) {
      // 还差另一半（比如只填了第 2 段重量）：留着提示、**保留用户已经填的东西**，
      // 等补全再写；填的本身不合法才还原成已保存的值。
      setWeightError(parsed.message);
      if (parsed.kind === 'invalid') {
        setWeightInputs(weightInputValues(set, slots));
        setRepsInputs(repsInputValues(set, slots));
      }
      return;
    }
    setWeightError(null);

    const storedDrops = set.dropWeights ?? [];
    const storedDropReps = set.dropReps ?? [];
    const dropsChanged =
      parsed.dropWeights.length !== storedDrops.length ||
      parsed.dropWeights.some((value, index) => value !== storedDrops[index]) ||
      parsed.dropReps.some((value, index) => value !== storedDropReps[index]);

    if (parsed.weight !== set.weight || dropsChanged) {
      patch.weight = parsed.weight;
      patch.dropWeights = parsed.dropWeights;
      patch.dropReps = parsed.dropReps;
    }
    if (parsed.reps !== set.reps) {
      patch.reps = parsed.reps;
    }

    if (Object.keys(patch).length > 0) {
      onUpdate(set.id, patch);
      return;
    }

    // 输入不合法就还原成已保存的值，不让用户看到假数据
    setWeightInputs(weightInputValues(set, slots));
    setRepsInputs(repsInputValues(set, slots));
  };

  const adjustWeight = (delta: number): void => {
    // 快捷加减只作用在第一段（递减组的下拉段本来就要手动递减）
    const next = roundWeight((Number(weightInputs[0]) || 0) + delta);
    setWeightInputs((current) => [formatWeightValue(next), ...current.slice(1)]);
    onUpdate(set.id, { weight: next });
  };

  /**
   * 切换单位时**换算数值**，而不是把数字原样换个标签。
   * 80kg 换成磅应该显示 176.4，因为实际举起来的重量没有变。
   */
  const changeUnit = (nextUnit: WeightUnit): void => {
    if (nextUnit === set.weightUnit) return;

    // 每一段都要换算：实际举起来的重量没变，只是显示单位变了
    const convert = (value: number): number =>
      roundWeight(fromKilograms(toKilograms(value, set.weightUnit), nextUnit));

    const weight = convert(set.weight);
    const dropWeights = (set.dropWeights ?? []).map(convert);

    setWeightInputs(weightInputValues({ weight, dropWeights }, slots));
    onUpdate(set.id, { weight, dropWeights, weightUnit: nextUnit });
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
            onClick={() => {
              const next = !set.completed;
              onUpdate(set.id, { completed: next });
              // 点「完成」就顺手开始休息计时 —— 练完一组本来就要歇，
              // 不用再单独去找计时器。没设休息时长的组不自动开始。
              if (next && set.restSeconds !== null && set.restSeconds > 0) {
                startRest({
                  setId: set.id,
                  exerciseName,
                  seconds: set.restSeconds,
                });
              }
            }}
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

      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {slots > 1
              ? `重量（前 ${required} 段必填${slots > required ? '，第 3 段可选' : ''}）`
              : '重量'}
          </span>
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

        <div className={cn('grid gap-2', slots > 1 ? 'grid-cols-3' : 'grid-cols-1')}>
          {Array.from({ length: slots }, (_, index) => (
            <div key={index} className="min-w-0 space-y-1">
              {slots > 1 ? (
                <span className="block text-center text-[10px] text-slate-400">
                  第 {index + 1} 段{index < required ? ' *' : ''}
                </span>
              ) : null}
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                aria-label={slots > 1 ? `第 ${index + 1} 段重量` : '重量'}
                data-testid={index === 0 ? 'set-weight' : `set-weight-${index + 1}`}
                value={weightInputs[index] ?? ''}
                disabled={disabled}
                onChange={(event) => {
                  const next = event.target.value;
                  setWeightInputs((current) =>
                    current.map((value, at) => (at === index ? next : value)),
                  );
                }}
                onBlur={commitNumbers}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                className={cn(
                  'field h-12 text-center font-semibold',
                  slots > 1 ? 'px-1 text-base' : 'px-2 text-lg',
                )}
              />
              {/* 递减组：每一段自己的次数 */}
              {slots > 1 ? (
                <input
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  aria-label={`第 ${index + 1} 段次数`}
                  data-testid={index === 0 ? 'set-reps' : `set-reps-${index + 1}`}
                  placeholder="次数"
                  value={repsInputs[index] ?? ''}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = event.target.value;
                    setRepsInputs((current) =>
                      current.map((value, at) => (at === index ? next : value)),
                    );
                  }}
                  onBlur={commitNumbers}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  className="field h-12 px-1 text-center text-base font-semibold"
                />
              ) : null}
            </div>
          ))}
        </div>

        {weightError ? (
          <p className="text-[11px] text-rose-600" data-testid="set-weight-error">
            {weightError}
          </p>
        ) : null}

        {slots === 1 ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">次数</span>
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              data-testid="set-reps"
              value={repsInputs[0] ?? ''}
              disabled={disabled}
              onChange={(event) => setRepsInputs([event.target.value])}
              onBlur={commitNumbers}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="field h-12 w-full px-2 text-center text-lg font-semibold"
            />
          </label>
        ) : null}

        <RestTimer
          setId={set.id}
          exerciseName={exerciseName}
          restSeconds={set.restSeconds}
          disabled={disabled}
          onRestChange={(seconds) => onUpdate(set.id, { restSeconds: seconds })}
        />
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
