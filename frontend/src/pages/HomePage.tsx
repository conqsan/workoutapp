import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { BackendStatusCard } from '@/components/BackendStatusCard';
import { DeviceStorageCard } from '@/components/DeviceStorageCard';
import { StatCard } from '@/components/StatCard';
import { initDataLayer, repository, type SupplementRecordWithSupplement } from '@/data';
import { todayKey } from '@/data/ids';
import { computeTodaySummary, type TodaySummary } from '@/utils/stats';
import { formatDateLabel, formatVolume } from '@/utils/format';

/** 开发环境才显示后端连接状态：线上没有后端，显示「未连接」会让人以为坏了 */
const isDev = import.meta.env.DEV;

export function HomePage(): ReactElement {
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [supplementRecords, setSupplementRecords] = useState<SupplementRecordWithSupplement[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await initDataLayer();
      const [workouts, records] = await Promise.all([
        repository.listWorkouts(),
        repository.listSupplementRecords({ date: todayKey() }),
      ]);
      if (cancelled) return;
      setToday(computeTodaySummary(workouts));
      setSupplementRecords(records);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasWorkout = (today?.workoutCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      <section className="card space-y-4">
        <div>
          <p className="text-sm text-slate-500">{formatDateLabel(new Date())}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {hasWorkout ? '今天已经练过了' : '今天还没有训练记录'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {hasWorkout
              ? `练到了 ${today?.muscleNames.join(' + ') || '（未记录部位）'} · ${today?.exerciseCount ?? 0} 个动作 · ${today?.setCount ?? 0} 组 · ${formatVolume(today?.volume ?? 0)}`
              : '去底部「训练」开始记录，数据会先存在这台设备上。'}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title px-1">今日概览</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="训练部位"
            value={today?.muscleNames.length ? today.muscleNames.join(' + ') : '—'}
            testId="today-muscles"
          />
          <StatCard
            label="动作数量"
            value={`${today?.exerciseCount ?? 0} 个`}
            testId="today-exercises"
          />
          <StatCard label="训练组数" value={`${today?.setCount ?? 0} 组`} testId="today-sets" />
          <StatCard
            label="训练总量"
            value={formatVolume(today?.volume ?? 0)}
            testId="today-volume"
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="section-title">今日补剂</h2>
          <Link to="/supplements" className="text-xs font-medium text-brand-600">
            管理 →
          </Link>
        </div>
        <div className="card space-y-1.5" data-testid="today-supplements">
          {supplementRecords.length === 0 ? (
            <p className="text-sm text-slate-500">
              还没有记录，去{' '}
              <Link to="/supplements" className="font-medium text-brand-600">
                记一笔
              </Link>
            </p>
          ) : (
            supplementRecords.map((record) => (
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
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title px-1">{isDev ? '系统状态' : '数据存储'}</h2>
        {isDev ? <BackendStatusCard /> : <DeviceStorageCard />}
      </section>
    </div>
  );
}
