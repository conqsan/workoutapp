import { useEffect, useMemo, useState } from 'react';
import { initDataLayer, repository } from '@/data';
import type { WorkoutDetail } from '@/data';
import {
  computeExerciseTotals,
  computeExerciseTrend,
  computeStats,
  type ExerciseTotals,
  type StatsSummary,
  type TrendPoint,
} from '@/utils/stats';

export interface ExerciseOption {
  id: string;
  name: string;
  setCount: number;
}

export interface UseStatsResult {
  loading: boolean;
  error: string | null;
  stats: StatsSummary | null;
  exerciseOptions: ExerciseOption[];
  selectedExerciseId: string;
  selectExercise: (id: string) => void;
  trend: TrendPoint[];
  totals: ExerciseTotals | null;
}

/**
 * 统计页的状态。
 * 全部在本地算：一次读出所有训练明细，之后的切换（换动作看趋势）都是纯计算。
 */
export function useStats(): UseStatsResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutDetail[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initDataLayer();
        const all = await repository.listWorkouts();
        if (!cancelled) setWorkouts(all);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '读取统计数据失败。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 只把练过的动作列出来当选项，按组数从多到少排
  const exerciseOptions = useMemo<ExerciseOption[]>(() => {
    const map = new Map<string, ExerciseOption>();
    for (const workout of workouts) {
      if (workout.status !== 'completed') continue;
      for (const entry of workout.exercises) {
        const existing = map.get(entry.exerciseId);
        if (existing) existing.setCount += entry.sets.length;
        else
          map.set(entry.exerciseId, {
            id: entry.exerciseId,
            name: entry.exerciseName,
            setCount: entry.sets.length,
          });
      }
    }
    return [...map.values()].sort(
      (a, b) => b.setCount - a.setCount || a.name.localeCompare(b.name),
    );
  }, [workouts]);

  // 默认选练得最多的那个动作
  useEffect(() => {
    if (selectedExerciseId === '' && exerciseOptions.length > 0) {
      const first = exerciseOptions[0];
      if (first) setSelectedExerciseId(first.id);
    }
  }, [exerciseOptions, selectedExerciseId]);

  const stats = useMemo(() => computeStats(workouts), [workouts]);

  const trend = useMemo(
    () => computeExerciseTrend(workouts, selectedExerciseId),
    [workouts, selectedExerciseId],
  );

  const totals = useMemo(
    () => computeExerciseTotals(workouts, selectedExerciseId),
    [workouts, selectedExerciseId],
  );

  return {
    loading,
    error,
    stats,
    exerciseOptions,
    selectedExerciseId,
    selectExercise: setSelectedExerciseId,
    trend,
    totals,
  };
}
