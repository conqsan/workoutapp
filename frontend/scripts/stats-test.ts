/**
 * 统计逻辑的单元测试（纯函数，不依赖浏览器）。
 *
 * 为什么单独做一份：Phase 6 的验收要求重点核对「日期边界、周统计、月统计、
 * 重量为 0、空数据」。这些用固定日期的纯函数测试最可靠 —— 端到端测试很难
 * 造出「跨月的那一周」这种场景。
 *
 * 运行：npm run test:stats（在 frontend/ 下）
 */

import type {
  WorkoutDetail,
  WorkoutExerciseWithSets,
  WorkoutSet,
  WeightUnit,
} from '../src/data/types';
import {
  computeExerciseTotals,
  computeExerciseTrend,
  computeStats,
  endOfWeek,
  monthRange,
  startOfWeek,
} from '../src/utils/stats';

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, extra?: unknown): void {
  checks += 1;
  if (condition) {
    console.log(`  \u2713 ${name}`);
  } else {
    failures += 1;
    console.error(`  \u2717 ${name}`);
    if (extra !== undefined) console.error('    实际结果:', JSON.stringify(extra));
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function near(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.01;
}

// ------------------------------------------------------------------ 固定数据

interface SetSpec {
  weight: number;
  reps: number;
  unit?: WeightUnit;
}

interface EntrySpec {
  exerciseId: string;
  exerciseName: string;
  muscleName: string;
  sets: SetSpec[];
}

let sequence = 0;

function makeSet(workoutExerciseId: string, spec: SetSpec, index: number): WorkoutSet {
  sequence += 1;
  return {
    id: `s${sequence}`,
    workoutExerciseId,
    setNumber: index + 1,
    weight: spec.weight,
    weightUnit: spec.unit ?? 'kg',
    reps: spec.reps,
    restSeconds: null,
    note: '',
    completed: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeWorkout(
  id: string,
  date: string,
  status: 'active' | 'completed',
  entries: EntrySpec[],
): WorkoutDetail {
  const exercises: WorkoutExerciseWithSets[] = entries.map((entry, entryIndex) => {
    sequence += 1;
    const entryId = `we${sequence}`;
    return {
      id: entryId,
      workoutId: id,
      exerciseId: entry.exerciseId,
      exerciseName: entry.exerciseName,
      muscleId: `m-${entry.muscleName}`,
      muscleName: entry.muscleName,
      sortOrder: entryIndex,
      note: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      sets: entry.sets.map((set, setIndex) => makeSet(entryId, set, setIndex)),
    };
  });

  const allSets = exercises.flatMap((exercise) => exercise.sets);

  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: status === 'completed' ? `${date}T11:00:00.000Z` : null,
    note: '',
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exercises,
    totalSets: allSets.length,
    totalVolume: allSets.reduce((total, set) => total + set.weight * set.reps, 0),
  };
}

// 2026-10-07 是周三
const NOW = new Date(2026, 9, 7, 20, 0, 0);

const WORKOUTS: WorkoutDetail[] = [
  makeWorkout('w1', '2026-10-01', 'completed', [
    {
      exerciseId: 'bench',
      exerciseName: '杠铃卧推',
      muscleName: '胸',
      sets: [
        { weight: 80, reps: 10 },
        { weight: 80, reps: 8 },
      ],
    },
  ]),
  makeWorkout('w2', '2026-10-03', 'completed', [
    {
      exerciseId: 'row',
      exerciseName: '杠铃划船',
      muscleName: '背',
      sets: [{ weight: 60, reps: 10 }],
    },
  ]),
  makeWorkout('w3', '2026-10-06', 'completed', [
    {
      exerciseId: 'squat',
      exerciseName: '深蹲',
      muscleName: '腿',
      sets: [{ weight: 100, reps: 5 }],
    },
  ]),
  makeWorkout('w4', '2026-10-07', 'completed', [
    {
      exerciseId: 'bench',
      exerciseName: '杠铃卧推',
      muscleName: '胸',
      sets: [{ weight: 85, reps: 5 }],
    },
    {
      exerciseId: 'fly',
      exerciseName: '蝴蝶机夹胸',
      muscleName: '胸',
      sets: [{ weight: 30, reps: 12 }],
    },
  ]),
  // 进行中的训练：不应该计入任何统计
  makeWorkout('w5', '2026-10-07', 'active', [
    {
      exerciseId: 'bench',
      exerciseName: '杠铃卧推',
      muscleName: '胸',
      sets: [{ weight: 999, reps: 99 }],
    },
  ]),
];

// ------------------------------------------------------------------ 测试

section('[1] 周 / 月的日期边界');
check('周三：本周一是 10-05', startOfWeek(NOW) === '2026-10-05', startOfWeek(NOW));
check('周三：本周日是 10-11', endOfWeek(NOW) === '2026-10-11', endOfWeek(NOW));
check(
  '周一当天：本周仍是 10-05 ~ 10-11',
  startOfWeek(new Date(2026, 9, 5)) === '2026-10-05' &&
    endOfWeek(new Date(2026, 9, 5)) === '2026-10-11',
);
check(
  '周日当天：本周仍是 10-05 ~ 10-11（周日算这一周的最后一天）',
  startOfWeek(new Date(2026, 9, 11)) === '2026-10-05' &&
    endOfWeek(new Date(2026, 9, 11)) === '2026-10-11',
);
check(
  '跨月的那一周：2026-11-01（周日）属于 10-26 ~ 11-01',
  startOfWeek(new Date(2026, 10, 1)) === '2026-10-26' &&
    endOfWeek(new Date(2026, 10, 1)) === '2026-11-01',
  [startOfWeek(new Date(2026, 10, 1)), endOfWeek(new Date(2026, 10, 1))],
);

check(
  '10 月是 10-01 ~ 10-31',
  monthRange(NOW).start === '2026-10-01' && monthRange(NOW).end === '2026-10-31',
  monthRange(NOW),
);
check(
  '平年 2 月是 28 天',
  monthRange(new Date(2026, 1, 15)).end === '2026-02-28',
  monthRange(new Date(2026, 1, 15)),
);
check(
  '闰年 2 月是 29 天',
  monthRange(new Date(2028, 1, 15)).end === '2028-02-29',
  monthRange(new Date(2028, 1, 15)),
);
check('月末当天仍属于本月：2026-10-31', monthRange(new Date(2026, 9, 31)).end === '2026-10-31');

section('[2] 训练次数：本周 / 本月 / 总计');
const stats = computeStats(WORKOUTS, NOW);
check('总计 4 次（进行中的那次不算）', stats.totalWorkouts === 4, stats.totalWorkouts);
check('进行中的训练被单独计数', stats.activeWorkoutCount === 1, stats.activeWorkoutCount);
check('本周 2 次（10/6 和 10/7）', stats.weekWorkouts === 2, stats.weekWorkouts);
check('本月 4 次（10/1、10/3、10/6、10/7）', stats.monthWorkouts === 4, stats.monthWorkouts);

section('[3] 训练总量：今天 / 本周 / 本月');
// 10/7：85×5 + 30×12 = 425 + 360 = 785
check('今天的训练总量 = 785kg', near(stats.todayVolume, 785), stats.todayVolume);
// 本周：10/6 的 500 + 10/7 的 785 = 1285
check('本周训练总量 = 1285kg', near(stats.weekVolume, 1285), stats.weekVolume);
// 本月：800+640 + 600 + 500 + 785 = 3325
check('本月训练总量 = 3325kg', near(stats.monthVolume, 3325), stats.monthVolume);
check('今天的量不会把进行中那次的 999×99 算进去', near(stats.todayVolume, 785), stats.todayVolume);

section('[4] 各部位 / 各动作训练次数');
const chest = stats.muscles.find((item) => item.name === '胸');
check('胸练了 2 次', chest?.workoutCount === 2, chest);
check('胸累计 4 组（10/1 两组 + 10/7 两组）', chest?.setCount === 4, chest);
check(
  '部位按次数倒序，胸在最前',
  stats.muscles[0]?.name === '胸',
  stats.muscles.map((item) => item.name),
);

const bench = stats.exercises.find((item) => item.name === '杠铃卧推');
check('杠铃卧推练了 2 次', bench?.workoutCount === 2, bench);
check('杠铃卧推累计 3 组', bench?.setCount === 3, bench);

section('[5] 重量为 0（自重动作）');
const zeroWorkout = makeWorkout('w0', '2026-10-07', 'completed', [
  {
    exerciseId: 'pullup',
    exerciseName: '引体向上',
    muscleName: '背',
    sets: [
      { weight: 0, reps: 10 },
      { weight: 0, reps: 8 },
    ],
  },
]);
const zeroStats = computeStats([zeroWorkout], NOW);
check('总量为 0（0 × 次数还是 0）', zeroStats.todayVolume === 0, zeroStats.todayVolume);
check('但训练次数仍然算 1 次', zeroStats.totalWorkouts === 1, zeroStats.totalWorkouts);
check('组数仍然算 2 组', zeroStats.exercises[0]?.setCount === 2, zeroStats.exercises[0]);
check('部位计数正常', zeroStats.muscles[0]?.name === '背', zeroStats.muscles);
check(
  '趋势里最大重量是 0，不会变成负数或 NaN',
  computeExerciseTrend([zeroWorkout], 'pullup')[0]?.maxWeightKg === 0,
  computeExerciseTrend([zeroWorkout], 'pullup'),
);

section('[6] 空数据');
const emptyStats = computeStats([], NOW);
check('次数全是 0', emptyStats.totalWorkouts === 0 && emptyStats.weekWorkouts === 0);
check(
  '总量全是 0',
  emptyStats.todayVolume === 0 && emptyStats.weekVolume === 0 && emptyStats.monthVolume === 0,
);
check(
  '部位 / 动作列表是空数组',
  emptyStats.muscles.length === 0 && emptyStats.exercises.length === 0,
);
check('没有训练时的趋势是空数组', computeExerciseTrend([], 'bench').length === 0);
check(
  '没有训练时的战绩是 0',
  computeExerciseTotals([], 'bench').totalVolumeKg === 0 &&
    computeExerciseTotals([], 'bench').latestWeightKg === null,
);

section('[7] lb 换算');
const lbWorkout = makeWorkout('wlb', '2026-10-07', 'completed', [
  {
    exerciseId: 'bench',
    exerciseName: '杠铃卧推',
    muscleName: '胸',
    sets: [{ weight: 100, reps: 5, unit: 'lb' }],
  },
]);
const lbStats = computeStats([lbWorkout], NOW);
check(
  '100lb × 5 ≈ 226.8kg（不是 500）',
  near(lbStats.todayVolume, 100 * 0.45359237 * 5),
  lbStats.todayVolume,
);
const lbTotals = computeExerciseTotals([lbWorkout], 'bench');
check('最大重量换算成 45.36kg', near(lbTotals.maxWeightKg, 45.36), lbTotals.maxWeightKg);

section('[8] 动作重量趋势');
const trend = computeExerciseTrend(WORKOUTS, 'bench');
check('卧推有 2 个数据点（10/1、10/7）', trend.length === 2, trend);
check('按日期升序', trend[0]?.date === '2026-10-01' && trend[1]?.date === '2026-10-07', trend);
check('10/1 最大重量 80kg', near(trend[0]?.maxWeightKg ?? 0, 80), trend[0]);
check('10/7 最大重量 85kg', near(trend[1]?.maxWeightKg ?? 0, 85), trend[1]);
check('X 轴标签是 MM-DD', trend[0]?.label === '10-01', trend[0]);

const mergedTrend = computeExerciseTrend(
  [
    makeWorkout('m1', '2026-10-07', 'completed', [
      {
        exerciseId: 'bench',
        exerciseName: '杠铃卧推',
        muscleName: '胸',
        sets: [{ weight: 60, reps: 10 }],
      },
    ]),
    makeWorkout('m2', '2026-10-07', 'completed', [
      {
        exerciseId: 'bench',
        exerciseName: '杠铃卧推',
        muscleName: '胸',
        sets: [{ weight: 70, reps: 5 }],
      },
    ]),
  ],
  'bench',
);
check('同一天练两次会合并成一个点', mergedTrend.length === 1, mergedTrend);
check('合并后取当天最大重量 70kg', near(mergedTrend[0]?.maxWeightKg ?? 0, 70), mergedTrend[0]);

section('[9] 动作战绩');
const totals = computeExerciseTotals(WORKOUTS, 'bench');
check('最大重量 85kg', near(totals.maxWeightKg, 85), totals);
check('最近一次是 85kg', near(totals.latestWeightKg ?? 0, 85), totals);
check('总训练量 = 800 + 640 + 425 = 1865kg', near(totals.totalVolumeKg, 1865), totals);
check('总组数 3 组', totals.totalSets === 3, totals);
check('练过 2 次', totals.workoutCount === 2, totals);

console.log('');
if (failures > 0) {
  console.error(
    `统计单元测试失败：${checks - failures}/${checks} 项通过，${failures} 项未通过。\n`,
  );
  process.exitCode = 1;
} else {
  console.log(`统计单元测试全部通过（${checks}/${checks}）。\n`);
}
