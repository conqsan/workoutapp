import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useHistoryDetail } from '@/hooks/useHistory';
import { formatDateKeyLabel, formatVolume } from '@/utils/format';
import { formatWeight } from '@/utils/weight';

export function HistoryDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading, workout, supplements, error, removing, remove } = useHistoryDetail(id);
  /** 删除不可撤销，所以点一次只是展开确认 */
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async (): Promise<void> => {
    const deleted = await remove();
    if (deleted) navigate('/history', { replace: true });
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />;
  }

  if (error || !workout) {
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
      <section className="card space-y-3">
        <div>
          <p className="text-sm text-slate-500">{formatDateKeyLabel(workout.date)}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {muscleNames.length > 0 ? muscleNames.join(' + ') : '未记录部位'}
          </p>
        </div>

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
        const volume = entry.sets.reduce((total, set) => total + set.weight * set.reps, 0);

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
                <li
                  key={set.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm"
                  data-testid="history-set"
                >
                  <span className="text-slate-500">第 {set.setNumber} 组</span>
                  <span className="font-medium text-slate-800">
                    {formatWeight(set.weight, set.weightUnit)} × {set.reps}
                  </span>
                  <span className="text-xs text-slate-400">
                    {set.restSeconds === null ? '—' : `休息 ${set.restSeconds}s`}
                  </span>
                </li>
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
