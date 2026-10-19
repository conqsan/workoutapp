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
  /** 「动作重量变化」里当前选中的部位 */
  selectedMuscle: string;
  selectMuscle: (name: string) => void;
  /** 当前部位下的动作（选动作前先选部位） */
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
  const [selectedMuscle, setSelectedMuscle] = useState('');
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

  const stats = useMemo(() => computeStats(workouts), [workouts]);

  /**
   * 动作选项按部位分组：先选部位、再选这个部位下的动作。
   *
   * 之前是一条平铺的长列表，动作一多就滑不到头；而且同名动作
   * （「双杠臂屈伸」在胸 / 三头各有一条）也分不清是哪边练的。
   */
  const groups = useMemo(() => stats?.exerciseGroups ?? [], [stats]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.muscleName === selectedMuscle) ?? groups[0] ?? null,
    [groups, selectedMuscle],
  );

  // 默认落在练得最多的那个部位
  useEffect(() => {
    if (groups.length === 0) return;
    if (selectedMuscle !== '' && groups.some((group) => group.muscleName === selectedMuscle)) {
      return;
    }
    const first = groups[0];
    if (first) setSelectedMuscle(first.muscleName);
  }, [groups, selectedMuscle]);

  // 换了部位之后，动作也要落到这个部位下练得最多的那个
  useEffect(() => {
    if (activeGroup === null) return;
    if (activeGroup.entries.some((entry) => entry.name === selectedExercise)) return;
    setSelectedExercise(activeGroup.entries[0]?.name ?? '');
  }, [activeGroup, selectedExercise]);

  const exerciseOptions = useMemo<ExerciseOption[]>(() => {
    if (activeGroup === null) return [];
    return activeGroup.entries.map((entry) => ({
      name: entry.name,
      muscleNames: [activeGroup.muscleName],
      setCount: entry.setCount,
      workoutCount: entry.workoutCount,
    }));
  }, [activeGroup]);

  const selectMuscle = (name: string): void => {
    setSelectedMuscle(name);
    const group = groups.find((item) => item.muscleName === name);
    setSelectedExercise(group?.entries[0]?.name ?? '');
  };

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
    selectedMuscle,
    selectMuscle,
    exerciseOptions,
    selectedExercise,
    selectExercise: setSelectedExercise,
    trend,
    totals,
  };
}
