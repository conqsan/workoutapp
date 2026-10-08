import { useEffect, useRef, useState, type ReactElement } from 'react';
import { SetRow } from './SetRow';
import type {
  LastWorkoutSummary,
  WorkoutExerciseWithSets,
  WorkoutSet,
  WorkoutSetInput,
  WorkoutSetPatch,
} from '@/data';
import { cn } from '@/utils/cn';
import { formatVolume } from '@/utils/format';
import { formatWeight, formatWeightValue } from '@/utils/weight';

/** 组芯片上显示的摘要；单位只在不是 kg 时显示，避免芯片过长 */
function chipSummary(set: WorkoutSet): string {
  const weight = formatWeightValue(set.weight);
  return set.weightUnit === 'kg'
    ? `${weight}×${set.reps}`
    : `${weight}${set.weightUnit}×${set.reps}`;
}

/** 给测试和无障碍用的完整摘要，始终带单位 */
function chipSummaryWithUnit(set: WorkoutSet): string {
  return `${formatWeightValue(set.weight)}${set.weightUnit}×${set.reps}`;
}

/** 组芯片的三种状态：选中 / 已完成 / 未完成 */
function chipClass(selected: boolean, completed: boolean): string {
  if (selected) return 'bg-brand-600 text-white';
  return completed ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600';
}

export interface WorkoutExerciseCardProps {
  entry: WorkoutExerciseWithSets;
  index: number;
  total: number;
  lastWorkout: LastWorkoutSummary | null | undefined;
  disabled: boolean;
  /** 手风琴：同一时间只展开一个动作，避免页面无限往下堆 */
  expanded: boolean;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onRemove: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
  onAddSet: (workoutExerciseId: string, input: WorkoutSetInput) => void;
  onCopyLastSet: (workoutExerciseId: string) => void;
  onCopyLastWorkout: (workoutExerciseId: string) => void;
  onUpdateSet: (id: string, patch: WorkoutSetPatch) => void;
  onRemoveSet: (id: string) => void;
}

/** 默认起始重量：没有历史可参考时，先给一个能直接改的数字，避免出现 0kg × 0 次 */
const FALLBACK_SET: WorkoutSetInput = { weight: 20, reps: 10 };

function formatDateLabel(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

export function WorkoutExerciseCard({
  entry,
  index,
  total,
  lastWorkout,
  disabled,
  expanded,
  onToggle,
  onMove,
  onRemove,
  onNoteChange,
  onAddSet,
  onCopyLastSet,
  onCopyLastWorkout,
  onUpdateSet,
  onRemoveSet,
}: WorkoutExerciseCardProps): ReactElement {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(entry.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  /** 组以横向芯片排列，只编辑选中的那一组 —— 加多少组卡片都不会变长 */
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const setStripRef = useRef<HTMLDivElement | null>(null);
  const previousSetCountRef = useRef(entry.sets.length);

  useEffect(() => setNote(entry.note), [entry.note]);
  useEffect(() => setConfirmRemove(false), [entry.id]);

  /**
   * 加了新的一组：自动选中它，并把芯片条横向滚到最右。
   * 直接改 scrollLeft，不用 scrollIntoView —— 后者会连带滚动整个页面。
   */
  useEffect(() => {
    const previous = previousSetCountRef.current;
    previousSetCountRef.current = entry.sets.length;
    if (entry.sets.length <= previous) return;

    setActiveSetId(entry.sets[entry.sets.length - 1]?.id ?? null);
    const strip = setStripRef.current;
    if (strip) strip.scrollLeft = strip.scrollWidth;
  }, [entry.sets]);

  /** 选中的那一组被删掉了，回落到最后一组 */
  useEffect(() => {
    if (activeSetId === null) return;
    if (entry.sets.some((set) => set.id === activeSetId)) return;
    setActiveSetId(entry.sets[entry.sets.length - 1]?.id ?? null);
  }, [activeSetId, entry.sets]);

  const volume = entry.sets.reduce((total2, set) => total2 + set.weight * set.reps, 0);
  const lastSet = entry.sets[entry.sets.length - 1];
  /** 没有明确选中时，默认编辑最后一组 */
  const activeSet =
    entry.sets.find((set) => set.id === activeSetId) ?? entry.sets[entry.sets.length - 1] ?? null;

  /**
   * 添加一组：优先沿用这一组上一次的数据，其次参考上次训练的组，
   * 都没有才用一个可编辑的默认值。这样「再做一组同样的」基本是一键完成。
   */
  const handleAddSet = (): void => {
    if (lastSet) {
      onAddSet(entry.id, {
        weight: lastSet.weight,
        weightUnit: lastSet.weightUnit,
        reps: lastSet.reps,
        restSeconds: lastSet.restSeconds,
      });
      return;
    }

    const historySet = lastWorkout?.sets[0];
    onAddSet(
      entry.id,
      historySet
        ? { weight: historySet.weight, weightUnit: historySet.weightUnit, reps: historySet.reps }
        : FALLBACK_SET,
    );
  };

  return (
    <section
      // 不用 .card：手风琴需要整块无内边距，展开区自己管留白
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70"
      data-testid="exercise-card"
      data-name={entry.exerciseName}
    >
      <button
        type="button"
        onClick={() => onToggle(entry.id)}
        data-testid="exercise-toggle"
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition',
          expanded ? 'bg-white' : 'bg-white hover:bg-slate-50',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            expanded ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700',
          )}
        >
          {index + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-slate-900">
            {entry.exerciseName}
          </span>
          <span className="block text-xs text-slate-400">
            {entry.muscleName} · {entry.sets.length} 组
          </span>
        </span>

        <span className="shrink-0 text-sm font-semibold text-slate-700">
          {formatVolume(volume)}
        </span>

        <span aria-hidden="true" className="shrink-0 text-lg text-slate-300">
          {expanded ? '⌃' : '⌄'}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">调整顺序 / 移除这个动作</span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="上移"
                disabled={disabled || index === 0}
                onClick={() => onMove(entry.id, 'up')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="下移"
                disabled={disabled || index === total - 1}
                onClick={() => onMove(entry.id, 'down')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setConfirmRemove(true)}
                className="flex h-8 items-center rounded-lg px-2 text-xs font-medium text-rose-500 ring-1 ring-rose-200 disabled:opacity-40"
              >
                删除动作
              </button>
            </div>
          </div>

          {confirmRemove ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2">
              <span className="text-sm text-rose-700">删除这个动作和它的所有组？</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-[32px] rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white"
                  onClick={() => onRemove(entry.id)}
                >
                  确认删除
                </button>
                <button
                  type="button"
                  className="min-h-[32px] rounded-lg px-3 text-xs font-medium text-slate-600"
                  onClick={() => setConfirmRemove(false)}
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {lastWorkout && lastWorkout.sets.length > 0 ? (
            <div
              className="space-y-2 rounded-xl bg-brand-50/70 px-3 py-2"
              data-testid="last-workout"
            >
              <p className="text-xs text-slate-500">
                上次训练（{formatDateLabel(lastWorkout.date)}）
              </p>
              <p className="text-sm font-medium text-slate-800">
                {lastWorkout.sets
                  .map((set) => `${formatWeight(set.weight, set.weightUnit)} × ${set.reps}`)
                  .join('   ')}
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onCopyLastWorkout(entry.id)}
                data-testid="copy-last-workout"
                className="min-h-[36px] w-full rounded-lg bg-white text-sm font-semibold text-brand-700 ring-1 ring-brand-200 disabled:opacity-50"
              >
                复制上次训练
              </button>
            </div>
          ) : null}

          {entry.sets.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
              还没有记录，先添加一组
            </p>
          ) : (
            <div className="space-y-2">
              {/* 组芯片：横向排列，点一下切换要编辑的组 */}
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" ref={setStripRef}>
                {entry.sets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    data-testid="set-chip"
                    data-summary={chipSummaryWithUnit(set)}
                    onClick={() => setActiveSetId(set.id)}
                    className={cn(
                      'min-h-[40px] shrink-0 rounded-full px-3 text-sm font-medium transition',
                      chipClass(set.id === activeSet?.id, set.completed),
                    )}
                  >
                    <span className="font-bold">{set.setNumber}</span>
                    <span className="ml-1.5">{chipSummary(set)}</span>
                  </button>
                ))}
              </div>

              {activeSet ? (
                <SetRow
                  set={activeSet}
                  disabled={disabled}
                  onUpdate={onUpdateSet}
                  onRemove={onRemoveSet}
                />
              ) : null}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={handleAddSet}
              data-testid="add-set"
              className="btn btn-primary h-12 flex-1 text-sm"
            >
              + 添加一组
            </button>
            <button
              type="button"
              disabled={disabled || entry.sets.length === 0}
              onClick={() => onCopyLastSet(entry.id)}
              data-testid="copy-last-set"
              className="btn btn-secondary h-12 text-sm disabled:opacity-40"
            >
              复制上一组
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setNoteOpen((open) => !open)}
              className={cn(
                'min-h-[36px] text-xs font-medium',
                entry.note ? 'text-brand-600' : 'text-slate-400',
              )}
            >
              {noteOpen ? '收起备注' : entry.note ? '动作备注：' + entry.note : '+ 加动作备注'}
            </button>
            {noteOpen ? (
              <input
                type="text"
                value={note}
                disabled={disabled}
                placeholder="这个动作今天的感受，例如：肩膀有点紧"
                onChange={(event) => setNote(event.target.value)}
                onBlur={() => {
                  if (note !== entry.note) onNoteChange(entry.id, note);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                className="field mt-2 h-11 text-sm"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
