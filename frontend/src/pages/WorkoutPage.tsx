import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateField } from '@/components/DateField';
import { ExercisePicker } from '@/components/workout/ExercisePicker';
import { WorkoutExerciseCard } from '@/components/workout/WorkoutExerciseCard';
import {
  initDataLayer,
  repository,
  type CreateExerciseInput,
  type Exercise,
  type Muscle,
  type WorkoutSummary,
} from '@/data';
import { todayKey } from '@/data/ids';
import { useWorkout } from '@/hooks/useWorkout';
import { formatDateLabel, formatVolume } from '@/utils/format';
import { formatWeight } from '@/utils/weight';

export function WorkoutPage(): ReactElement {
  const navigate = useNavigate();
  const {
    loading,
    workout,
    lastWorkouts,
    error,
    saving,
    clearError,
    start,
    complete,
    discard,
    setNote,
    addExercise,
    removeExercise,
    moveExercise,
    setExerciseNote,
    addSet,
    copyLastSet,
    updateSet,
    removeSet,
    copyLastWorkout,
  } = useWorkout();

  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [workoutNote, setWorkoutNote] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [startDate, setStartDate] = useState(() => todayKey());
  /** 今天已经完成的训练，用来把「还没开始」这一屏说清楚 */
  const [todayCompleted, setTodayCompleted] = useState<WorkoutSummary[]>([]);
  /** 手风琴：null = 还没决定（首次加载后展开第一个），'' = 用户主动全部收起 */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const previousExerciseCountRef = useRef(-1);

  useEffect(() => {
    void (async () => {
      await initDataLayer();
      const [muscleList, exerciseList] = await Promise.all([
        repository.listMuscles(),
        repository.listExercises(),
      ]);
      setMuscles(muscleList);
      setExercises(exerciseList);
    })();
  }, []);

  /**
   * 今天是否已经练过。
   * 之前这屏写死了「今天还没有训练记录」，练完再进来还是这句话，很容易以为数据丢了。
   * 依据 workout.id / status 变化重算（改一组不会触发重新查询）。
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initDataLayer();
      const all = await repository.listWorkoutSummaries();
      if (cancelled) return;
      const today = todayKey();
      setTodayCompleted(
        all.filter((summary) => summary.date === today && summary.status === 'completed'),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [workout?.id, workout?.status]);

  const todayTotals = useMemo(() => {
    const muscles = new Set<string>();
    let exerciseCount = 0;
    let setCount = 0;
    let volume = 0;

    for (const summary of todayCompleted) {
      for (const name of summary.muscleNames) muscles.add(name);
      exerciseCount += summary.exerciseCount;
      setCount += summary.setCount;
      volume += summary.totalVolume;
    }

    return {
      workoutCount: todayCompleted.length,
      muscleNames: [...muscles],
      exerciseCount,
      setCount,
      volume,
    };
  }, [todayCompleted]);

  useEffect(() => {
    setWorkoutNote(workout?.note ?? '');
  }, [workout?.note]);

  /**
   * 保证「一次只展开一个动作」：
   * 刚加了动作就展开新加的那个；否则保持当前；当前那个被删了就回到第一个。
   * 用户主动全部收起（''）时不强行展开。
   */
  useEffect(() => {
    if (!workout) {
      previousExerciseCountRef.current = -1;
      return;
    }

    const ids = workout.exercises.map((entry) => entry.id);
    const previousCount = previousExerciseCountRef.current;
    const grew = previousCount >= 0 && ids.length > previousCount;
    previousExerciseCountRef.current = ids.length;

    setExpandedId((current) => {
      if (ids.length === 0) return '';
      if (grew) return ids[ids.length - 1] ?? '';
      if (current === null) return ids[0] ?? '';
      if (current === '') return '';
      return ids.includes(current) ? current : (ids[0] ?? '');
    });
  }, [workout]);

  const muscleSummary = useMemo(() => {
    const names = (workout?.exercises ?? []).map((entry) => entry.muscleName);
    return Array.from(new Set(names.filter((name) => name.length > 0))).join(' + ');
  }, [workout]);

  const handlePick = useCallback(
    (exerciseId: string) => {
      setPickerOpen(false);
      void addExercise(exerciseId);
    },
    [addExercise],
  );

  const handleCreateExercise = useCallback(
    async (input: CreateExerciseInput) => {
      const created = await repository.createExercise(input);
      setExercises(await repository.listExercises());
      setPickerOpen(false);
      await addExercise(created.id);
    },
    [addExercise],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    );
  }

  // ---------------------------------------------------------------- 还没开始
  if (!workout) {
    return (
      <div className="space-y-4">
        {error ? <ErrorBanner message={error} onClose={clearError} /> : null}

        <section className="card space-y-4">
          <div>
            <p className="text-sm text-slate-500">{formatDateLabel(new Date())}</p>
            <p className="mt-1 text-xl font-bold text-slate-900" data-testid="workout-start-title">
              {todayTotals.workoutCount > 0 ? '今天已经练过了' : '今天还没有训练记录'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {todayTotals.workoutCount > 0
                ? `练到了 ${todayTotals.muscleNames.join(' + ') || '（未记录部位）'} · ${todayTotals.exerciseCount} 个动作 · ${todayTotals.setCount} 组 · ${formatVolume(todayTotals.volume)}。想再来一次就改下面的日期或直接开始。`
                : '选好日期点下面的按钮开始，训练数据会先存在这台设备上。'}
            </p>
          </div>

          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">
              训练日期（要补记以前某天的训练就改这里）
            </span>
            <DateField
              value={startDate}
              testId="start-date"
              ariaLabel="训练日期"
              onChange={(next) => setStartDate(next || todayKey())}
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void start(startDate)}
            data-testid="start-workout"
            className="btn btn-primary h-14 w-full text-base"
          >
            {todayTotals.workoutCount > 0 ? '再练一次' : '开始训练'}
          </button>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------- 已完成
  if (workout.status === 'completed') {
    return (
      <div className="space-y-4">
        <section className="card space-y-3">
          <p className="text-sm font-semibold text-brand-700">✓ 训练已完成</p>
          <h2 className="text-xl font-bold text-slate-900">{muscleSummary || '训练'}</h2>
          <dl className="grid grid-cols-2 gap-3 pt-1">
            <SummaryItem label="动作" value={`${workout.exercises.length} 个`} />
            <SummaryItem label="总组数" value={`${workout.totalSets} 组`} />
            <SummaryItem label="训练总量 (kg)" value={formatVolume(workout.totalVolume)} />
            <SummaryItem label="用时" value={formatDuration(workout.startTime, workout.endTime)} />
          </dl>
        </section>

        <div className="space-y-2">
          {workout.exercises.map((entry) => (
            <section key={entry.id} className="card space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-800">{entry.exerciseName}</h3>
              <p className="text-sm text-slate-600">
                {entry.sets
                  .map((set) => `${formatWeight(set.weight, set.weightUnit)} × ${set.reps}`)
                  .join('   ')}
              </p>
            </section>
          ))}
        </div>

        <button type="button" className="btn btn-primary h-12 w-full" onClick={() => navigate('/')}>
          返回首页
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------- 训练中
  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onClose={clearError} /> : null}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
              训练中
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {workout.date} · 开始于 {formatTime(workout.startTime)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900" data-testid="total-sets">
              {workout.totalSets} 组
            </p>
            <p className="text-xs text-slate-400" data-testid="total-volume">
              {formatVolume(workout.totalVolume)}
            </p>
          </div>
        </div>

        {muscleSummary ? (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
            训练部位：{muscleSummary}
          </p>
        ) : null}

        <div>
          <button
            type="button"
            onClick={() => setNoteOpen((open) => !open)}
            className="text-xs font-medium text-slate-400"
          >
            {noteOpen
              ? '收起训练备注'
              : workout.note
                ? `训练备注：${workout.note}`
                : '+ 加训练备注'}
          </button>
          {noteOpen ? (
            <input
              type="text"
              value={workoutNote}
              placeholder="今天的状态、感受…"
              onChange={(event) => setWorkoutNote(event.target.value)}
              onBlur={() => {
                if (workoutNote !== workout.note) void setNote(workoutNote);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="field mt-2 h-11 text-sm"
            />
          ) : null}
        </div>
      </section>

      {workout.exercises.map((entry, index) => (
        <WorkoutExerciseCard
          key={entry.id}
          entry={entry}
          index={index}
          total={workout.exercises.length}
          lastWorkout={lastWorkouts[entry.exerciseId]}
          disabled={saving}
          expanded={expandedId === entry.id}
          onToggle={(id) => setExpandedId((current) => (current === id ? '' : id))}
          onMove={(id, direction) => void moveExercise(id, direction)}
          onRemove={(id) => void removeExercise(id)}
          onNoteChange={(id, note) => void setExerciseNote(id, note)}
          onAddSet={(id, input) => void addSet(id, input)}
          onCopyLastSet={(id) => void copyLastSet(id)}
          onCopyLastWorkout={(id) => void copyLastWorkout(id)}
          onUpdateSet={(id, patch) => void updateSet(id, patch)}
          onRemoveSet={(id) => void removeSet(id)}
        />
      ))}

      {pickerOpen ? (
        <ExercisePicker
          muscles={muscles}
          exercises={exercises}
          disabled={saving}
          onPick={handlePick}
          onCreate={handleCreateExercise}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          data-testid="open-exercise-picker"
          className="btn btn-secondary h-14 w-full text-base"
        >
          + 添加动作
        </button>
      )}

      <div className="space-y-2 pt-2">
        <button
          type="button"
          disabled={saving || workout.exercises.length === 0}
          onClick={() => void complete()}
          data-testid="complete-workout"
          className="btn btn-primary h-14 w-full text-base disabled:opacity-40"
        >
          完成训练
        </button>

        {confirmDiscard ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2">
            <span className="text-sm text-rose-700">这次训练会被删掉，确定？</span>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="confirm-discard"
                className="min-h-[32px] rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white"
                onClick={() => void discard()}
              >
                确认删除
              </button>
              <button
                type="button"
                className="min-h-[32px] rounded-lg px-3 text-xs font-medium text-slate-600"
                onClick={() => setConfirmDiscard(false)}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDiscard(true)}
            data-testid="discard-workout"
            className="min-h-[40px] w-full text-xs font-medium text-slate-400"
          >
            放弃这次训练
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-base font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2">
      <p className="text-sm text-rose-700">{message}</p>
      <button type="button" onClick={onClose} className="text-xs font-medium text-rose-500">
        知道了
      </button>
    </div>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  return minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${minutes} 分钟`;
}
