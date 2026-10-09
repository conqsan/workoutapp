import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DateField } from '@/components/DateField';
import { HistorySetRow } from '@/components/history/HistorySetRow';
import { useHistoryDetail } from '@/hooks/useHistory';
import { formatDateKeyLabel, formatVolume } from '@/utils/format';
import { calculateTotalVolumeKg } from '@/utils/weight';

export function HistoryDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    loading,
    workout,
    supplements,
    error,
    removing,
    saving,
    update,
    updateSet,
    removeSet,
    remove,
  } = useHistoryDetail(id);
  /** 删除不可撤销，所以点一次只是展开确认 */
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** 「修改这次训练」：日期与备注 */
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const startEditing = (): void => {
    setDraftDate(workout?.date ?? '');
    setDraftNote(workout?.note ?? '');
    setEditingWorkout(true);
  };

  const saveWorkout = async (): Promise<void> => {
    await update({ date: draftDate, note: draftNote });
    setEditingWorkout(false);
  };

  const handleDelete = async (): Promise<void> => {
    const deleted = await remove();
    if (deleted) navigate('/history', { replace: true });
  };

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

  const muscleNames = Array.from(
    new Set(workout.exercises.map((entry) => entry.muscleName).filter((name) => name !== '')),
  );

  return (
    <div className="space-y-4">
      {/* 修改失败之类的情况：留在这一页上提示，不要把已经加载好的详情页顶掉 */}
      {error ? (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{formatDateKeyLabel(workout.date)}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {muscleNames.length > 0 ? muscleNames.join(' + ') : '未记录部位'}
            </p>
          </div>
          {editingWorkout ? null : (
            <button
              type="button"
              disabled={saving}
              onClick={startEditing}
              data-testid="edit-workout"
              className="min-h-[36px] shrink-0 rounded-lg px-3 text-xs font-medium text-brand-600 ring-1 ring-brand-200 disabled:opacity-50"
            >
              修改
            </button>
          )}
        </div>

        {editingWorkout ? (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3" data-testid="workout-editor">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">训练日期</span>
              <DateField
                value={draftDate}
                testId="edit-workout-date"
                ariaLabel="训练日期"
                onChange={setDraftDate}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">训练备注</span>
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
                onClick={() => void saveWorkout()}
                data-testid="save-workout"
                className="btn btn-primary h-11 flex-1 text-sm"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditingWorkout(false)}
                className="btn btn-secondary h-11 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        <dl className="grid grid-cols-3 gap-3">
          <Stat label="动作" value={`${workout.exercises.length} 个`} />
          <Stat label="总组数" value={`${workout.totalSets} 组`} />
          <Stat label="训练总量" value={formatVolume(workout.totalVolume)} />
        </dl>

        {workout.note ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            备注：{workout.note}
          </p>
        ) : null}

        {workout.status === 'active' ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
            这次训练还没有完成。
          </p>
        ) : null}
      </section>

      {workout.exercises.map((entry, index) => {
        // 每组都换算成 kg 再累加：混着 kg / lb 的组直接相加是没有意义的
        const volume = calculateTotalVolumeKg(entry.sets);

        return (
          <section
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
                  disabled={saving}
                  onUpdate={(setId, patch) => void updateSet(setId, patch)}
                  onRemove={(setId) => void removeSet(setId)}
                />
              ))}
            </ul>

            {entry.note ? <p className="text-xs text-slate-500">备注：{entry.note}</p> : null}
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

      <section className="space-y-2 pt-1">
        {confirmDelete ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2"
            data-testid="confirm-delete-workout"
          >
            <span className="text-sm text-rose-700">删除这次训练？删掉就找不回来了。</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => void handleDelete()}
                data-testid="delete-workout-confirm"
                className="min-h-[36px] rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                确认删除
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[36px] rounded-lg px-3 text-xs font-medium text-slate-600"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={removing}
            onClick={() => setConfirmDelete(true)}
            data-testid="delete-workout"
            className="min-h-[40px] w-full text-xs font-medium text-rose-500 disabled:opacity-40"
          >
            删除这次训练
          </button>
        )}

        <p className="px-1 text-center text-[11px] text-slate-400">
          只删这次训练（含它的动作与组），当天的补剂记录会保留。
        </p>
      </section>
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
