import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ExerciseTrendChart } from '@/components/stats/ExerciseTrendChart';
import { useStats } from '@/hooks/useStats';
import { cn } from '@/utils/cn';
import { formatVolume } from '@/utils/format';

export function StatsPage(): ReactElement {
  const {
    loading,
    error,
    stats,
    exerciseOptions,
    selectedExerciseId,
    selectExercise,
    trend,
    totals,
  } = useStats();

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>;
  }

  if (!stats || stats.totalWorkouts === 0) {
    return (
      <section className="card space-y-3 text-center">
        <p className="text-base font-semibold text-slate-900">还没有可以统计的数据</p>
        <p className="text-sm text-slate-500">完成一次训练之后，这里就会有统计了。</p>
        <Link to="/workout" className="btn btn-primary h-12 w-full">
          去训练
        </Link>
      </section>
    );
  }

  const selectedName =
    exerciseOptions.find((option) => option.id === selectedExerciseId)?.name ?? '动作';

  return (
    <div className="space-y-4">
      {stats.activeWorkoutCount > 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          有 {stats.activeWorkoutCount} 次进行中的训练没有计入统计（完成后才算）。
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="section-title px-1">训练次数</h2>
        <div className="grid grid-cols-2 gap-3">
          <BigStat
            label="本周"
            value={`${stats.weekWorkouts}`}
            unit="次"
            testId="stat-week-workouts"
          />
          <BigStat
            label="本月"
            value={`${stats.monthWorkouts}`}
            unit="次"
            testId="stat-month-workouts"
          />
        </div>
        <p className="px-1 text-[11px] text-slate-400">
          一周从周一开始算；合计已完成 {stats.totalWorkouts} 次训练。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="section-title px-1">训练总量 (kg)</h2>
        <div className="grid grid-cols-3 gap-2">
          <SmallStat
            label="今天"
            value={formatVolume(stats.todayVolume)}
            testId="stat-today-volume"
          />
          <SmallStat
            label="本周"
            value={formatVolume(stats.weekVolume)}
            testId="stat-week-volume"
          />
          <SmallStat
            label="本月"
            value={formatVolume(stats.monthVolume)}
            testId="stat-month-volume"
          />
        </div>
      </section>

      <section className="card space-y-3" data-testid="stat-muscles">
        <h2 className="text-base font-semibold text-slate-900">各部位训练次数</h2>
        <CountList
          items={stats.muscles.map((item) => ({
            name: item.name,
            primary: `${item.workoutCount} 次`,
            secondary: `${item.setCount} 组`,
            ratio: item.workoutCount / (stats.muscles[0]?.workoutCount || 1),
          }))}
        />
      </section>

      <section className="card space-y-3" data-testid="stat-exercises">
        <h2 className="text-base font-semibold text-slate-900">各动作训练次数</h2>
        <CountList
          items={stats.exercises.map((item) => ({
            name: item.name,
            primary: `${item.workoutCount} 次`,
            secondary: `${item.setCount} 组`,
            ratio: item.workoutCount / (stats.exercises[0]?.workoutCount || 1),
          }))}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">动作重量变化</h2>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {exerciseOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid="trend-exercise"
              data-name={option.name}
              onClick={() => selectExercise(option.id)}
              className={cn(
                'min-h-[36px] shrink-0 rounded-full px-3 text-sm font-medium transition',
                option.id === selectedExerciseId
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {option.name}
            </button>
          ))}
        </div>

        {trend.length === 0 ? (
          <p className="text-sm text-slate-500">这个动作还没有已完成的数据。</p>
        ) : (
          <>
            <ExerciseTrendChart points={trend} />
            <p className="text-center text-[11px] text-slate-400">
              每次训练中「{selectedName}」的最大重量（kg）
            </p>
          </>
        )}

        {totals ? (
          <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
            <MiniStat label="最大重量" value={`${totals.maxWeightKg} kg`} testId="trend-max" />
            <MiniStat
              label="最近重量"
              value={totals.latestWeightKg === null ? '—' : `${totals.latestWeightKg} kg`}
              testId="trend-latest"
            />
            <MiniStat
              label="总训练量"
              value={formatVolume(totals.totalVolumeKg)}
              testId="trend-volume"
            />
          </dl>
        ) : null}
      </section>
    </div>
  );
}

function BigStat({
  label,
  value,
  unit,
  testId,
}: {
  label: string;
  value: string;
  unit: string;
  testId: string;
}): ReactElement {
  return (
    <div className="card">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-1" data-testid={testId}>
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        <span className="text-sm text-slate-500">{unit}</span>
      </p>
    </div>
  );
}

function SmallStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}): ReactElement {
  return (
    <div className="card px-3 py-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}): ReactElement {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

interface CountListItem {
  name: string;
  primary: string;
  secondary: string;
  ratio: number;
}

function CountList({ items }: { items: CountListItem[] }): ReactElement {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">还没有数据。</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name} data-name={item.name}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-slate-800">{item.name}</span>
            <span className="shrink-0 text-slate-500">
              {item.primary} · {item.secondary}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(4, Math.round(item.ratio * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
