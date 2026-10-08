import { useMemo, useState, type ReactElement } from 'react';
import type { CreateExerciseInput, Exercise, Muscle } from '@/data';
import { cn } from '@/utils/cn';

export interface ExercisePickerProps {
  muscles: Muscle[];
  exercises: Exercise[];
  disabled: boolean;
  onPick: (exerciseId: string) => void;
  onCreate: (input: CreateExerciseInput) => Promise<void>;
}

/**
 * 选部位 → 选动作。
 *
 * 刻意做成「内嵌面板」而不是弹窗：训练过程中减少弹窗层级，
 * 而且面板出现的位置就在「+ 添加动作」按钮下面，单手点得到。
 */
export function ExercisePicker({
  muscles,
  exercises,
  disabled,
  onPick,
  onCreate,
}: ExercisePickerProps): ReactElement {
  const [search, setSearch] = useState('');
  const [muscleId, setMuscleId] = useState<string>(muscles[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingBusy, setCreatingBusy] = useState(false);

  const keyword = search.trim();

  const visible = useMemo(() => {
    if (keyword.length > 0) {
      return exercises.filter((exercise) => exercise.name.includes(keyword));
    }
    return exercises.filter((exercise) => exercise.muscleId === muscleId);
  }, [exercises, keyword, muscleId]);

  const muscleNameById = useMemo(
    () => new Map(muscles.map((muscle) => [muscle.id, muscle.name])),
    [muscles],
  );

  const submitCreate = async (): Promise<void> => {
    const name = newName.trim();
    if (name.length === 0) {
      setCreateError('请输入动作名称。');
      return;
    }
    if (muscleId === '') {
      setCreateError('请先选择一个训练部位。');
      return;
    }

    setCreatingBusy(true);
    setCreateError(null);
    try {
      await onCreate({ name, muscleId });
      setNewName('');
      setCreating(false);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : '创建失败，请重试。');
    } finally {
      setCreatingBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white p-3 ring-1 ring-brand-200">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜索动作（也可以直接选部位）"
        className="field h-11 text-sm"
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {muscles.map((muscle) => (
          <button
            key={muscle.id}
            type="button"
            data-testid="muscle-chip"
            data-name={muscle.name}
            onClick={() => {
              setMuscleId(muscle.id);
              setSearch('');
            }}
            className={cn(
              'min-h-[36px] shrink-0 rounded-full px-3 text-sm font-medium transition',
              !keyword && muscle.id === muscleId
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600',
            )}
          >
            {muscle.name}
          </button>
        ))}
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-1 py-3 text-sm text-slate-500">没有匹配的动作，可以新建一个。</p>
        ) : (
          visible.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              disabled={disabled}
              data-testid="exercise-option"
              data-name={exercise.name}
              onClick={() => onPick(exercise.id)}
              className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl px-3 text-left transition active:scale-[0.99] hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="truncate text-[15px] font-medium text-slate-800">
                {exercise.name}
              </span>
              <span className="shrink-0 text-xs text-slate-400">
                {muscleNameById.get(exercise.muscleId) ?? ''}
                {exercise.isCustom ? ' · 自定义' : ''}
              </span>
            </button>
          ))
        )}
      </div>

      {creating ? (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            新建动作到「{muscleNameById.get(muscleId) ?? '未选择部位'}」
          </p>
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="动作名称，例如：器械卧推"
            className="field h-11 text-sm"
          />
          {createError ? <p className="text-xs text-rose-600">{createError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={creatingBusy}
              onClick={() => void submitCreate()}
              className="btn btn-primary h-11 flex-1 text-sm"
            >
              创建并添加
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateError(null);
              }}
              className="btn btn-secondary h-11 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="min-h-[40px] w-full rounded-xl text-sm font-medium text-brand-600 ring-1 ring-brand-200"
        >
          + 新建自定义动作
        </button>
      )}
    </div>
  );
}
