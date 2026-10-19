import { useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DateField } from '@/components/DateField';
import { HistorySetRow } from '@/components/history/HistorySetRow';
import { ExercisePicker } from '@/components/workout/ExercisePicker';
import { useHistoryDetail } from '@/hooks/useHistory';
import type { CreateExerciseInput, WorkoutDetail } from '@/data';
import { formatDateKeyLabel, formatVolume } from '@/utils/format';
import { calculateTotalVolumeKg } from '@/utils/weight';

/** ISO 时间 -> HH:MM（本地时区） */
function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function sessionRange(workout: WorkoutDetail): string {
  const start = formatClock(workout.startTime);
  if (workout.endTime === null) return `${start} 开始`;
  return `${start} – ${formatClock(workout.endTime)}`;
}

/**
 * 一天的训练详情。
 *
 * 历史列表按天合并成一条，所以这里会把**当天每一次训练**都列出来：
 * 一次练完再来一次是很常见的情况，靠场次标题里的开始 / 结束时间区分。
 * 每一次训练都能单独改时间、备注、删掉，也能往里加动作、加组。
 */
export function HistoryDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    loading,
    workout,
    sessions,
    supplements,
    slotsByExerciseId,
    muscles,
    exercises,
    error,
    removing,
    saving,
    update,
    updateSet,
    removeSet,
    addExercise,
    createExercise,
    addSet,
    removeWorkout,
  } = useHistoryDetail(id);

  /** 正在改哪一次训练（日期 / 备注） */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const [draftNote, setDraftNote] = useState('');
  /** 删除不可撤销，点一次只是展开确认 */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  /** 正在给哪一次训练挑动作 */
  const [pickingForId, setPickingForId] = useState<string | null>(null);

  const day = useMemo(() => {
    const muscleNames = Array.from(
      new Set(
        sessions.flatMap((session) =>
          session.exercises.map((entry) => entry.muscleName).filter((name) => name !== ''),
        ),
      ),
    );
    const exerciseNames = new Set(
      sessions.flatMap((session) => session.exercises.map((entry) => entry.exerciseName)),
    );
    return {
      date: workout?.date ?? '',
      muscleNames,
      exerciseCount: exerciseNames.size,
      setCount: sessions.reduce((total, session) => total + session.totalSets, 0),
      volume: sessions.reduce((total, session) => total + session.totalVolume, 0),
      notes: Array.from(
        new Set(sessions.map((session) => session.note).filter((note) => note !== '')),
      ),
    };
  }, [sessions, workout]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />;
  }

  if (!workout) {
    return (
      <section className="card space-y-3 text-center">
        <p className="text-sm text-slate-600">{error ?? '找不到这次训练。'}</p>
        <Link to="/history" className="btn btn-secondary h-12 w-full">
          返回历史
        </Link>
      </section>
    );
  }

  const startEditing = (session: WorkoutDetail): void => {
    setDraftDate(session.date);
    setDraftNote(session.note);
    setEditingId(session.id);
  };

  const saveSession = async (session: WorkoutDetail): Promise<void> => {
    const movedToAnotherDay = draftDate !== session.date;
    await update(session.id, { date: draftDate, note: draftNote });
    setEditingId(null);
    // 改了日期就等于把这次训练挪出本日，回到列表重新看
    if (movedToAnotherDay) navigate('/history', { replace: true });
  };

  const handleDeleteSession = async (sessionId: string): Promise<void> => {
    const remaining = sessions.filter((session) => session.id !== sessionId);
    setConfirmDeleteId(null);
    await removeWorkout(sessionId);
    if (remaining.length === 0) {
      navigate('/history', { replace: true });
      return;
    }
    if (sessionId === id) {
      const next = remaining[0];
      if (next) navigate(`/history/${next.id}`, { replace: true });
    }
  };

  return (
    <div className="space-y-4">
      {/* 修改失败之类的情况：留在这一页上提示，不要把已经加载好的详情页顶掉 */}
      {error ? (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{formatDateKeyLabel(day.date)}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {day.muscleNames.length > 0 ? day.muscleNames.join(' + ') : '未记录部位'}
            </p>
          </div>
          {sessions.length > 1 ? (
            <span
              className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
              data-testid="history-session-count"
            >
              一天 {sessions.length} 次
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-3">
          <Stat label="动作" value={`${day.exerciseCount} 个`} />
          <Stat label="总组数" value={`${day.setCount} 组`} />
          <Stat label="训练总量" value={formatVolume(day.volume)} />
        </dl>

        {day.notes.length > 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            备注：{day.notes.join('；')}
          </p>
        ) : null}
      </section>

      {sessions.map((session, sessionIndex) => {
        const sessionMuscles = Array.from(
          new Set(session.exercises.map((entry) => entry.muscleName).filter((name) => name !== '')),
        );
        const editing = editingId === session.id;
        const confirming = confirmDeleteId === session.id;
        const picking = pickingForId === session.id;

        return (
          <section
            key={session.id}
            className="space-y-2"
            data-testid="history-session"
            data-id={session.id}
            data-range={sessionRange(session)}
          >
            <div className="flex items-start justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  第 {sessionIndex + 1} 次
                  <span
                    className="ml-2 text-xs font-normal text-slate-400"
                    data-testid="history-session-time"
                  >
                    {sessionRange(session)}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {sessionMuscles.length > 0 ? sessionMuscles.join(' + ') : '未记录部位'} ·{' '}
                  {session.totalSets} 组 · {formatVolume(session.totalVolume)}
                </p>
              </div>

              {editing ? null : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => startEditing(session)}
                  data-testid="edit-workout"
                  className="min-h-[32px] shrink-0 rounded-lg px-2.5 text-xs font-medium text-brand-600 ring-1 ring-brand-200 disabled:opacity-50"
                >
                  修改
                </button>
              )}
            </div>

            {editing ? (
              <div className="card space-y-3" data-testid="workout-editor">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">
                    训练日期
                  </span>
                  <DateField
                    value={draftDate}
                    testId="edit-workout-date"
                    ariaLabel="训练日期"
                    onChange={setDraftDate}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">
                    训练备注
                  </span>
                  <input
                    type="text"
                    value={draftNote}
                    data-testid="edit-workout-note"
                    placeholder="今天的状态、感受…（可留空）"
                    onChange={(event) => setDraftNote(event.target.value)}
                    className="field h-11 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveSession(session)}
                    data-testid="save-workout"
                    className="btn btn-primary h-11 flex-1 text-sm"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="btn btn-secondary h-11 text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}

            {session.status === 'active' ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                这次训练还没有完成。
              </p>
            ) : null}

            {session.exercises.length === 0 ? (
              <p className="card text-center text-sm text-slate-500">这次训练还没有动作。</p>
            ) : null}

            {session.exercises.map((entry, index) => {
              // 每组都换算成 kg 再累加：混着 kg / lb 的组直接相加是没有意义的
              const volume = calculateTotalVolumeKg(entry.sets);

              return (
                <article
                  key={entry.id}
                  className="card space-y-2"
                  data-testid="history-exercise"
                  data-name={entry.exerciseName}
                >
                  <header className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {entry.exerciseName}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {entry.muscleName} · {entry.sets.length} 组
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-700">
                      {formatVolume(volume)}
                    </p>
                  </header>

                  <ul className="space-y-1">
                    {entry.sets.map((set) => (
                      <HistorySetRow
                        key={set.id}
                        set={set}
                        weightSlots={slotsByExerciseId[entry.exerciseId] ?? 1}
                        disabled={saving}
                        onUpdate={(setId, patch) => void updateSet(setId, patch)}
                        onRemove={(setId) => void removeSet(setId)}
                      />
                    ))}
                  </ul>

                  {entry.note ? <p className="text-xs text-slate-500">备注：{entry.note}</p> : null}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void addSet(entry.id)}
                    data-testid="history-add-set"
                    className="min-h-[36px] w-full rounded-lg text-xs font-semibold text-brand-700 ring-1 ring-brand-200 disabled:opacity-40"
                  >
                    + 添加一组（沿用上一组）
                  </button>
                </article>
              );
            })}

            {picking ? (
              <div className="space-y-2">
                <ExercisePicker
                  muscles={muscles}
                  exercises={exercises}
                  disabled={saving}
                  onPick={async (exerciseId) => {
                    await addExercise(session.id, exerciseId);
                    setPickingForId(null);
                  }}
                  onCreate={async (input: CreateExerciseInput) => {
                    await createExercise(session.id, input);
                    setPickingForId(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPickingForId(null)}
                  className="min-h-[36px] w-full text-xs font-medium text-slate-500"
                >
                  收起
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => setPickingForId(session.id)}
                data-testid="add-history-exercise"
                className="card min-h-[44px] w-full text-sm font-semibold text-brand-700 disabled:opacity-40"
              >
                + 添加动作
              </button>
            )}

            <div className="px-1 pt-1">
              {confirming ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2">
                  <span className="text-sm text-rose-700">删除第 {sessionIndex + 1} 次训练？</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => void handleDeleteSession(session.id)}
                      data-testid="delete-workout-confirm"
                      className="min-h-[34px] rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="min-h-[34px] rounded-lg px-3 text-xs font-medium text-slate-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => setConfirmDeleteId(session.id)}
                  data-testid="delete-workout"
                  className="min-h-[36px] w-full text-xs font-medium text-rose-500 disabled:opacity-40"
                >
                  删除这次训练
                </button>
              )}
            </div>
          </section>
        );
      })}

      <section className="card space-y-2" data-testid="history-supplements">
        <h2 className="text-base font-semibold text-slate-900">当天补剂</h2>
        {supplements.length === 0 ? (
          <p className="text-sm text-slate-500">这一天没有补剂记录。</p>
        ) : (
          supplements.map((record) => (
            <p key={record.id} className="flex justify-between text-sm">
              <span className="font-medium text-slate-800">{record.supplementName}</span>
              <span className="text-slate-600">
                {record.amount}
                {record.unit}
                {record.consumptionTime ? ` · ${record.consumptionTime}` : ''}
              </span>
            </p>
          ))
        )}
      </section>

      <p className="px-1 pb-2 text-center text-[11px] text-slate-400">
        删除只影响训练本身，当天的补剂记录会保留。
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-base font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
