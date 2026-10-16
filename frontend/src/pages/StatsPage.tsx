import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ExerciseTrendChart } from '@/components/stats/ExerciseTrendChart';
import { useStats } from '@/hooks/useStats';
import { cn } from '@/utils/cn';
import { formatVolume } from '@/utils/format';
import type { MuscleExerciseGroup } from '@/utils/stats';

export function StatsPage(): ReactElement {
  const {
    loading,
    error,
    stats,
    exerciseOptions,
    selectedExercise,
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

  const selectedName = selectedExercise === '' ? '动作' : selectedExercise;

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
            label="近 30 天"
            value={`${stats.last30Workouts}`}
            unit="次"
            testId="stat-last30-workouts"
          />
        </div>
        <p className="px-1 text-[11px] text-slate-400">
          一周从周一开始算；近 30 天含今天。合计已完成 {stats.totalWorkouts} 次训练。
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
            label="近 30 天"
            value={formatVolume(stats.last30Volume)}
            testId="stat-last30-volume"
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
        <p className="text-[11px] text-slate-400">
          按训练部位分组（一共 {stats.exercises.length} 个动作），点部位展开看细节。
        </p>
        <ExerciseGroupList groups={stats.exerciseGroups} />
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900">动作重量变化</h2>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {exerciseOptions.map((option) => (
            <button
              key={option.name}
              type="button"
              data-testid="trend-exercise"
              data-name={option.name}
              onClick={() => selectExercise(option.name)}
              className={cn(
                'min-h-[36px] shrink-0 rounded-full px-3 text-sm font-medium transition',
                option.name === selectedExercise
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

/**
 * 「各动作训练次数」按部位折叠展示。
 *
 * 动作多了之后一条长列表既看不完也翻不动，所以按部位分组：
 * 默认只展开练得最多的那一组，其余收起；想一次看全就点「全部展开」。
 */
function ExerciseGroupList({ groups }: { groups: MuscleExerciseGroup[] }): ReactElement {
  const [open, setOpen] = useState<string[]>(() =>
    groups[0] === undefined ? [] : [groups[0].muscleName],
  );

  if (groups.length === 0) {
    return <p className="text-sm text-slate-500">还没有数据。</p>;
  }

  const allOpen = open.length === groups.length;

  return (
    <div className="space-y-2" data-testid="exercise-groups">
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="toggle-exercise-groups"
          onClick={() => setOpen(allOpen ? [] : groups.map((group) => group.muscleName))}
          className="min-h-[32px] text-xs font-medium text-brand-600"
        >
          {allOpen ? '全部收起' : '全部展开'}
        </button>
      </div>

      {groups.map((group) => {
        const expanded = open.includes(group.muscleName);
        const setCount = group.entries.reduce((total, item) => total + item.setCount, 0);

        return (
          <div
            key={group.muscleName}
            className="rounded-xl bg-slate-50 ring-1 ring-slate-200"
            data-testid="exercise-group"
            data-name={group.muscleName}
          >
            <button
              type="button"
              onClick={() =>
                setOpen((current) =>
                  current.includes(group.muscleName)
                    ? current.filter((name) => name !== group.muscleName)
                    : [...current, group.muscleName],
                )
              }
              data-testid="exercise-group-toggle"
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-800">
                  {group.muscleName}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {group.entries.length} 个动作 · {setCount} 组
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-slate-300">
                {expanded ? '⌃' : '⌄'}
              </span>
            </button>

            {expanded ? (
              <div className="border-t border-slate-200/70 px-3 pb-1 pt-2">
                <CountList
                  items={group.entries.map((item) => ({
                    name: item.name,
                    primary: `${item.workoutCount} 次`,
                    secondary: `${item.setCount} 组`,
                    ratio: item.workoutCount / (group.entries[0]?.workoutCount || 1),
                  }))}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
