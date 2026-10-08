import type { WorkoutDetail } from '../data/types';
import { toDateKey } from './format';
import { toKilograms } from './weight';

/**
 * 统计口径（很重要，先定清楚）：
 *
 * 1. **只统计已完成的训练**。进行中的还没结束，算进「训练次数」会虚高。
 * 2. **训练总量一律换算成 kg**，和 kg/lb 的规则一致。
 * 3. **一周从周一开始**（国内习惯），到周日结束。
 * 4. 「部位 / 动作训练次数」= 有多少次训练里练到了它（同一次训练里重复出现只算一次），
 *    另外附上总组数，方便看训练量。
 */

export interface CountEntry {
  name: string;
  /** 多少次训练里出现过 */
  workoutCount: number;
  /** 总组数 */
  setCount: number;
}

export interface StatsSummary {
  totalWorkouts: number;
  weekWorkouts: number;
  monthWorkouts: number;
  /** 有几次训练还在进行中（没计入上面的统计） */
  activeWorkoutCount: number;
  todayVolume: number;
  weekVolume: number;
  monthVolume: number;
  muscles: CountEntry[];
  exercises: CountEntry[];
}

export interface TrendPoint {
  date: string;
  /** 图表 X 轴显示的短标签，例如 10-06 */
  label: string;
  maxWeightKg: number;
  volumeKg: number;
  setCount: number;
}

export interface TodaySummary {
  workoutCount: number;
  muscleNames: string[];
  exerciseCount: number;
  setCount: number;
  volume: number;
}

/**
 * 「今天的记录」—— 和统计页不同，这里**包含进行中的训练**：
 * 正在练的时候，首页应该能实时看到今天已经举了多少。
 */
export function computeTodaySummary(
  workouts: readonly WorkoutDetail[],
  now: Date = new Date(),
): TodaySummary {
  const today = toDateKey(now);
  const muscles = new Set<string>();
  let workoutCount = 0;
  let exerciseCount = 0;
  let setCount = 0;
  let volume = 0;

  for (const workout of workouts) {
    if (workout.date !== today) continue;

    workoutCount += 1;
    for (const entry of workout.exercises) {
      exerciseCount += 1;
      setCount += entry.sets.length;
      if (entry.muscleName.length > 0) muscles.add(entry.muscleName);
      for (const set of entry.sets) {
        volume += toKilograms(set.weight, set.weightUnit) * set.reps;
      }
    }
  }

  return {
    workoutCount,
    muscleNames: [...muscles],
    exerciseCount,
    setCount,
    volume,
  };
}

// ------------------------------------------------------------------ 日期边界

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** 本周一（周一作为一周的第一天） */
export function startOfWeek(date: Date): string {
  const probe = startOfDay(date);
  const weekday = probe.getDay(); // 0 = 周日
  probe.setDate(probe.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return toDateKey(probe);
}

/** 本周日 */
export function endOfWeek(date: Date): string {
  const probe = startOfDay(date);
  const weekday = probe.getDay();
  probe.setDate(probe.getDate() + (weekday === 0 ? 0 : 7 - weekday));
  return toDateKey(probe);
}

/** 当月第一天与最后一天（自动处理 2 月、大小月） */
export function monthRange(date: Date): { start: string; end: string } {
  return {
    start: toDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

/**
 * 'YYYY-MM-DD' 是定长格式，字典序就等于时间序，直接比字符串即可。
 * 两端都包含。
 */
function within(dateKey: string, start: string, end: string): boolean {
  return dateKey >= start && dateKey <= end;
}

// ------------------------------------------------------------------ 计算

function emptyEntry(name: string): CountEntry {
  return { name, workoutCount: 0, setCount: 0 };
}

function bump(map: Map<string, CountEntry>, name: string, workoutDelta: number, setDelta: number) {
  if (name.length === 0) return;
  const entry = map.get(name) ?? emptyEntry(name);
  entry.workoutCount += workoutDelta;
  entry.setCount += setDelta;
  map.set(name, entry);
}

function workoutVolume(workout: WorkoutDetail): number {
  let total = 0;
  for (const entry of workout.exercises) {
    for (const set of entry.sets) {
      total += toKilograms(set.weight, set.weightUnit) * set.reps;
    }
  }
  return total;
}

function byCountThenName(a: CountEntry, b: CountEntry): number {
  return b.workoutCount - a.workoutCount || b.setCount - a.setCount || a.name.localeCompare(b.name);
}

export function computeStats(
  workouts: readonly WorkoutDetail[],
  now: Date = new Date(),
): StatsSummary {
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const month = monthRange(now);
  const today = toDateKey(now);

  let totalWorkouts = 0;
  let weekWorkouts = 0;
  let monthWorkouts = 0;
  let activeWorkoutCount = 0;
  let todayVolume = 0;
  let weekVolume = 0;
  let monthVolume = 0;

  const muscleMap = new Map<string, CountEntry>();
  const exerciseMap = new Map<string, CountEntry>();

  for (const workout of workouts) {
    if (workout.status !== 'completed') {
      activeWorkoutCount += 1;
      continue;
    }

    totalWorkouts += 1;

    const inWeek = within(workout.date, weekStart, weekEnd);
    const inMonth = within(workout.date, month.start, month.end);
    const volume = workoutVolume(workout);

    if (inWeek) {
      weekWorkouts += 1;
      weekVolume += volume;
    }
    if (inMonth) {
      monthWorkouts += 1;
      monthVolume += volume;
    }
    if (workout.date === today) {
      todayVolume += volume;
    }

    // 同一次训练里同一个部位 / 动作只算一次「训练次数」
    const musclesSeen = new Set<string>();
    const exercisesSeen = new Set<string>();

    for (const entry of workout.exercises) {
      const setCount = entry.sets.length;
      const muscleName = entry.muscleName;

      if (muscleName.length > 0) {
        bump(muscleMap, muscleName, musclesSeen.has(muscleName) ? 0 : 1, setCount);
        musclesSeen.add(muscleName);
      }

      const exerciseName = entry.exerciseName;
      if (exerciseName.length > 0) {
        bump(exerciseMap, exerciseName, exercisesSeen.has(exerciseName) ? 0 : 1, setCount);
        exercisesSeen.add(exerciseName);
      }
    }
  }

  return {
    totalWorkouts,
    weekWorkouts,
    monthWorkouts,
    activeWorkoutCount,
    todayVolume,
    weekVolume,
    monthVolume,
    muscles: [...muscleMap.values()].sort(byCountThenName),
    exercises: [...exerciseMap.values()].sort(byCountThenName).slice(0, 12),
  };
}

/**
 * 某个动作的重量趋势（按天聚合，同一天多次训练合并）。
 * 重量统一换算成 kg，方便和别的记录比较。
 */
export function computeExerciseTrend(
  workouts: readonly WorkoutDetail[],
  exerciseId: string,
): TrendPoint[] {
  const byDate = new Map<string, TrendPoint>();

  for (const workout of workouts) {
    if (workout.status !== 'completed') continue;

    const sets = workout.exercises
      .filter((entry) => entry.exerciseId === exerciseId)
      .flatMap((entry) => entry.sets);
    if (sets.length === 0) continue;

    const maxWeightKg = Math.max(
      ...sets.map((set) => Math.round(toKilograms(set.weight, set.weightUnit) * 100) / 100),
    );
    const volumeKg = sets.reduce(
      (total, set) => total + toKilograms(set.weight, set.weightUnit) * set.reps,
      0,
    );

    const existing = byDate.get(workout.date);
    if (existing) {
      existing.maxWeightKg = Math.max(existing.maxWeightKg, maxWeightKg);
      existing.volumeKg += volumeKg;
      existing.setCount += sets.length;
    } else {
      byDate.set(workout.date, {
        date: workout.date,
        label: workout.date.slice(5),
        maxWeightKg,
        volumeKg,
        setCount: sets.length,
      });
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** 某个动作的整体战绩：最大重量、最近重量、总训练量、总组数 */
export interface ExerciseTotals {
  maxWeightKg: number;
  latestWeightKg: number | null;
  totalVolumeKg: number;
  totalSets: number;
  workoutCount: number;
}

export function computeExerciseTotals(
  workouts: readonly WorkoutDetail[],
  exerciseId: string,
): ExerciseTotals {
  let maxWeightKg = 0;
  let latestWeightKg: number | null = null;
  let totalVolumeKg = 0;
  let totalSets = 0;
  let workoutCount = 0;
  let latestDate = '';

  for (const workout of workouts) {
    if (workout.status !== 'completed') continue;

    const sets = workout.exercises
      .filter((entry) => entry.exerciseId === exerciseId)
      .flatMap((entry) => entry.sets);
    if (sets.length === 0) continue;

    workoutCount += 1;
    totalSets += sets.length;

    for (const set of sets) {
      const kg = toKilograms(set.weight, set.weightUnit);
      maxWeightKg = Math.max(maxWeightKg, kg);
      totalVolumeKg += kg * set.reps;
      if (workout.date >= latestDate) {
        latestDate = workout.date;
        latestWeightKg = kg;
      }
    }
  }

  return {
    maxWeightKg: Math.round(maxWeightKg * 100) / 100,
    latestWeightKg: latestWeightKg === null ? null : Math.round(latestWeightKg * 100) / 100,
    totalVolumeKg,
    totalSets,
    workoutCount,
  };
}
