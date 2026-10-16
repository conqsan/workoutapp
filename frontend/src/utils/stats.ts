import type { WorkoutDetail } from '../data/types';
import { toDateKey } from './format';
import { calculateSetVolumeKg, maxSetWeightKg } from './weight';

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

/**
 * 动作的计数。
 * 同名动作可能分布在多个部位（例如「双杠臂屈伸」在胸和三头各有一条），
 * 趋势 / 战绩按**动作名**合并成一份，动作次数列表则额外记下它在哪些部位出现过。
 */
export interface ExerciseCountEntry extends CountEntry {
  muscleNames: string[];
}

/** 「各动作训练次数」按部位分组后的一组 */
export interface MuscleExerciseGroup {
  muscleName: string;
  entries: ExerciseCountEntry[];
}

export interface StatsSummary {
  totalWorkouts: number;
  weekWorkouts: number;
  /** 近 30 天（含今天）完成了几次训练 */
  last30Workouts: number;
  /** 有几次训练还在进行中（没计入上面的统计） */
  activeWorkoutCount: number;
  todayVolume: number;
  weekVolume: number;
  /** 近 30 天（含今天）的训练总量 */
  last30Volume: number;
  muscles: CountEntry[];
  /** 全部练过的动作，按训练次数倒序 —— 不截断，动作多了靠分组展示 */
  exercises: ExerciseCountEntry[];
  /** 同一份数据按部位分组，供「各动作训练次数」折叠展示 */
  exerciseGroups: MuscleExerciseGroup[];
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
        // 递减组：这一组的所有段都算进今天的量
        volume += calculateSetVolumeKg(set);
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

/**
 * 近 30 天：从 29 天前到今天（含今天，一共 30 天）。
 *
 * 为什么不用「本月」：月初那几天「本月」只有一两次，看着像没练，容易误判；
 * 滚动 30 天不管今天几号都是同一个尺子，更适合看「最近练得够不够」。
 */
export function last30Range(date: Date): { start: string; end: string } {
  const start = startOfDay(date);
  start.setDate(start.getDate() - 29);
  return { start: toDateKey(start), end: toDateKey(date) };
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
  return workout.exercises.reduce(
    (total, entry) =>
      total + entry.sets.reduce((inner, set) => inner + calculateSetVolumeKg(set), 0),
    0,
  );
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
  const last30 = last30Range(now);
  const today = toDateKey(now);

  let totalWorkouts = 0;
  let weekWorkouts = 0;
  let last30Workouts = 0;
  let activeWorkoutCount = 0;
  let todayVolume = 0;
  let weekVolume = 0;
  let last30Volume = 0;

  const muscleMap = new Map<string, CountEntry>();
  const exerciseMap = new Map<string, ExerciseCountEntry>();
  /** 部位 → 动作 → 计数（分组展示用，不合并跨部位的同名动作） */
  const groupMap = new Map<string, Map<string, ExerciseCountEntry>>();

  for (const workout of workouts) {
    if (workout.status !== 'completed') {
      activeWorkoutCount += 1;
      continue;
    }

    totalWorkouts += 1;

    const inWeek = within(workout.date, weekStart, weekEnd);
    const inLast30 = within(workout.date, last30.start, last30.end);
    const volume = workoutVolume(workout);

    if (inWeek) {
      weekWorkouts += 1;
      weekVolume += volume;
    }
    if (inLast30) {
      last30Workouts += 1;
      last30Volume += volume;
    }
    if (workout.date === today) {
      todayVolume += volume;
    }

    // 同一次训练里同一个部位 / 动作只算一次「训练次数」
    const musclesSeen = new Set<string>();
    const exercisesSeen = new Set<string>();
    const pairsSeen = new Set<string>();

    for (const entry of workout.exercises) {
      const setCount = entry.sets.length;
      const muscleName = entry.muscleName;

      if (muscleName.length > 0) {
        bump(muscleMap, muscleName, musclesSeen.has(muscleName) ? 0 : 1, setCount);
        musclesSeen.add(muscleName);
      }

      const exerciseName = entry.exerciseName;
      if (exerciseName.length === 0) continue;

      const totals = exerciseMap.get(exerciseName) ?? {
        name: exerciseName,
        workoutCount: 0,
        setCount: 0,
        muscleNames: [],
      };
      totals.workoutCount += exercisesSeen.has(exerciseName) ? 0 : 1;
      totals.setCount += setCount;
      if (muscleName.length > 0 && !totals.muscleNames.includes(muscleName)) {
        totals.muscleNames.push(muscleName);
      }
      exerciseMap.set(exerciseName, totals);
      exercisesSeen.add(exerciseName);

      if (muscleName.length === 0) continue;

      const bucket = groupMap.get(muscleName) ?? new Map<string, ExerciseCountEntry>();
      const grouped = bucket.get(exerciseName) ?? {
        name: exerciseName,
        workoutCount: 0,
        setCount: 0,
        muscleNames: [muscleName],
      };
      const pairKey = `${muscleName}\u0000${exerciseName}`;
      grouped.workoutCount += pairsSeen.has(pairKey) ? 0 : 1;
      grouped.setCount += setCount;
      bucket.set(exerciseName, grouped);
      groupMap.set(muscleName, bucket);
      pairsSeen.add(pairKey);
    }
  }

  const muscles = [...muscleMap.values()].sort(byCountThenName);
  const muscleOrder = new Map(muscles.map((item, index) => [item.name, index]));
  const exerciseGroups: MuscleExerciseGroup[] = [...groupMap.entries()]
    .map(([muscleName, entries]) => ({
      muscleName,
      entries: [...entries.values()].sort(byCountThenName),
    }))
    .sort(
      (a, b) =>
        (muscleOrder.get(a.muscleName) ?? Number.MAX_SAFE_INTEGER) -
        (muscleOrder.get(b.muscleName) ?? Number.MAX_SAFE_INTEGER),
    );

  return {
    totalWorkouts,
    weekWorkouts,
    last30Workouts,
    activeWorkoutCount,
    todayVolume,
    weekVolume,
    last30Volume,
    muscles,
    exercises: [...exerciseMap.values()].sort(byCountThenName),
    exerciseGroups,
  };
}

/**
 * 某个动作的重量趋势（按天聚合，同一天多次训练合并）。
 *
 * 按**动作名**取数据，不按 id：同一动作可能在多个部位下各有一条
 * （「双杠臂屈伸」既在胸也在三头），按 id 会让它变成两条互不相干的曲线。
 * 重量统一换算成 kg，方便和别的记录比较。
 */
export function computeExerciseTrend(
  workouts: readonly WorkoutDetail[],
  exerciseName: string,
): TrendPoint[] {
  if (exerciseName === '') return [];

  const byDate = new Map<string, TrendPoint>();

  for (const workout of workouts) {
    if (workout.status !== 'completed') continue;

    const sets = workout.exercises
      .filter((entry) => entry.exerciseName === exerciseName)
      .flatMap((entry) => entry.sets);
    if (sets.length === 0) continue;

    // 递减组取最大的那一段，volume 把每一段都算进去
    const maxWeightKg = Math.max(...sets.map((set) => Math.round(maxSetWeightKg(set) * 100) / 100));
    const volumeKg = sets.reduce((total, set) => total + calculateSetVolumeKg(set), 0);

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
  exerciseName: string,
): ExerciseTotals {
  if (exerciseName === '') {
    return {
      maxWeightKg: 0,
      latestWeightKg: null,
      totalVolumeKg: 0,
      totalSets: 0,
      workoutCount: 0,
    };
  }

  let maxWeightKg = 0;
  let latestWeightKg: number | null = null;
  let totalVolumeKg = 0;
  let totalSets = 0;
  let workoutCount = 0;
  let latestDate = '';

  for (const workout of workouts) {
    if (workout.status !== 'completed') continue;

    const sets = workout.exercises
      .filter((entry) => entry.exerciseName === exerciseName)
      .flatMap((entry) => entry.sets);
    if (sets.length === 0) continue;

    workoutCount += 1;
    totalSets += sets.length;

    for (const set of sets) {
      const kg = maxSetWeightKg(set);
      maxWeightKg = Math.max(maxWeightKg, kg);
      totalVolumeKg += calculateSetVolumeKg(set);
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
