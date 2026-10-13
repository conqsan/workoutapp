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
  /** 动作名即键：同一个动作在多个部位下也只算一个（趋势按动作看） */
  name: string;
  /** 这个动作在哪些部位练过 */
  muscleNames: string[];
  setCount: number;
  workoutCount: number;
}

export interface UseStatsResult {
  loading: boolean;
  error: string | null;
  stats: StatsSummary | null;
  exerciseOptions: ExerciseOption[];
  selectedExercise: string;
  selectExercise: (name: string) => void;
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
  const [selectedExercise, setSelectedExercise] = useState('');

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

  // 只把练过的动作列出来当选项，按组数从多到少排。
  // 按动作名去重：同名动作（例如「双杠臂屈伸」在胸 / 三头）只出现一次。
  const exerciseOptions = useMemo<ExerciseOption[]>(() => {
    const map = new Map<string, ExerciseOption>();
    for (const workout of workouts) {
      if (workout.status !== 'completed') continue;

      const seen = new Set<string>();
      for (const entry of workout.exercises) {
        const name = entry.exerciseName;
        if (name.length === 0) continue;

        const option = map.get(name) ?? {
          name,
          muscleNames: [],
          setCount: 0,
          workoutCount: 0,
        };
        option.setCount += entry.sets.length;
        if (!seen.has(name)) {
          option.workoutCount += 1;
          seen.add(name);
        }
        if (entry.muscleName.length > 0 && !option.muscleNames.includes(entry.muscleName)) {
          option.muscleNames.push(entry.muscleName);
        }
        map.set(name, option);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.setCount - a.setCount || a.name.localeCompare(b.name),
    );
  }, [workouts]);

  // 默认选练得最多的那个动作
  useEffect(() => {
    if (selectedExercise === '' && exerciseOptions.length > 0) {
      const first = exerciseOptions[0];
      if (first) setSelectedExercise(first.name);
    }
  }, [exerciseOptions, selectedExercise]);

  const stats = useMemo(() => computeStats(workouts), [workouts]);

  const trend = useMemo(
    () => computeExerciseTrend(workouts, selectedExercise),
    [workouts, selectedExercise],
  );

  const totals = useMemo(
    () => computeExerciseTotals(workouts, selectedExercise),
    [workouts, selectedExercise],
  );

  return {
    loading,
    error,
    stats,
    exerciseOptions,
    selectedExercise,
    selectExercise: setSelectedExercise,
    trend,
    totals,
  };
}
