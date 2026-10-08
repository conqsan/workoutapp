/**
 * 备份 / 恢复的单元测试（纯函数，不依赖浏览器、不碰 IndexedDB）。
 *
 * 为什么单独做一份：导出 / 导入是本地优先架构下**唯一**的数据找回手段，
 * 而「校验格式 → 校验结构 → 去重 → 合并引用」这套规则必须能脱离 UI 反复验证。
 * 尤其是去重：导错一次就可能把历史数据搅乱，所以边界（同一份导两次、跨设备 id
 * 不同但名字相同、引用的动作在本机不存在）都要有用例。
 *
 * 运行：npm run test:backup（在 frontend/ 下）
 */

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  countBackup,
  describeCounts,
  describeImportResult,
  parseBackupText,
  planImport,
  serializeWorkoutSetsCsv,
  toBackupJson,
  validateBackup,
  type BackupData,
  type BackupSnapshot,
  type BackupWorkout,
  type ImportPlan,
} from '../src/data/backup';
import type { WorkoutDetail } from '../src/data/types';

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

const CREATED_AT = '2026-09-01T10:00:00.000Z';

/** 一份「另一台设备」上导出的备份：部位 / 动作的 id 和本机对不上，只能按名字认 */
function makeSnapshot(): BackupSnapshot {
  const workout: BackupWorkout = {
    id: 'w1',
    date: '2026-09-01',
    startTime: '2026-09-01T10:00:00.000Z',
    endTime: '2026-09-01T11:00:00.000Z',
    note: '',
    status: 'completed',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    exercises: [
      {
        id: 'we1',
        workoutId: 'w1',
        exerciseId: 'e1',
        exerciseName: '杠铃卧推',
        muscleId: 'm1',
        muscleName: '胸',
        sortOrder: 0,
        note: '',
        createdAt: CREATED_AT,
        sets: [
          {
            id: 's1',
            workoutExerciseId: 'we1',
            setNumber: 1,
            weight: 80,
            weightUnit: 'kg',
            reps: 10,
            restSeconds: 90,
            note: '',
            completed: true,
            createdAt: CREATED_AT,
          },
          {
            id: 's2',
            workoutExerciseId: 'we1',
            setNumber: 2,
            weight: 75,
            weightUnit: 'kg',
            reps: 8,
            restSeconds: null,
            note: '',
            completed: true,
            createdAt: CREATED_AT,
          },
        ],
      },
    ],
  };

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: '0.1.0',
    exportedAt: CREATED_AT,
    data: {
      muscles: [
        { id: 'm1', name: '胸', sortOrder: 1 },
        { id: 'm2', name: '背', sortOrder: 2 },
      ],
      exercises: [
        {
          id: 'e1',
          name: '杠铃卧推',
          muscleId: 'm1',
          description: null,
          isCustom: false,
          sortOrder: 0,
        },
        {
          id: 'e2',
          name: '引体向上',
          muscleId: 'm2',
          description: null,
          isCustom: false,
          sortOrder: 1,
        },
      ],
      supplements: [{ id: 'sup1', name: '蛋白粉', unit: 'g', isDefault: true, sortOrder: 0 }],
      supplementRecords: [
        {
          id: 'sr1',
          supplementId: 'sup1',
          date: '2026-09-01',
          amount: 30,
          unit: 'g',
          consumptionTime: '训练后',
          note: '',
          createdAt: CREATED_AT,
        },
      ],
      workouts: [workout],
    },
  };
}

function emptyData(): BackupData {
  return { muscles: [], exercises: [], supplements: [], supplementRecords: [], workouts: [] };
}

/** 把「导入计划」当成导入之后的库：这样「同一份导两次」可以直接复用 planImport 的结果 */
function planToData(plan: ImportPlan): BackupData {
  return {
    muscles: plan.muscles,
    exercises: plan.exercises,
    supplements: plan.supplements,
    supplementRecords: plan.supplementRecords,
    workouts: plan.workouts.map((workout) => ({
      ...workout,
      exercises: plan.workoutExercises
        .filter((entry) => entry.workoutId === workout.id)
        .map((entry) => ({
          ...entry,
          sets: plan.workoutSets.filter((set) => set.workoutExerciseId === entry.id),
        })),
    })),
  };
}

function makeWorkoutDetail(): WorkoutDetail {
  return {
    id: 'w1',
    date: '2026-09-01',
    startTime: '2026-09-01T10:00:00.000Z',
    endTime: null,
    note: '状态不错',
    status: 'completed',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    totalVolume: 0,
    totalSets: 2,
    exercises: [
      {
        id: 'we1',
        workoutId: 'w1',
        exerciseId: 'e1',
        exerciseName: '杠铃卧推',
        muscleId: 'm1',
        muscleName: '胸',
        sortOrder: 0,
        note: '肩膀有点紧',
        createdAt: CREATED_AT,
        sets: [
          {
            id: 's1',
            workoutExerciseId: 'we1',
            setNumber: 1,
            weight: 80,
            weightUnit: 'kg',
            reps: 10,
            restSeconds: 90,
            note: '',
            completed: true,
            createdAt: CREATED_AT,
          },
          {
            id: 's2',
            workoutExerciseId: 'we1',
            setNumber: 2,
            weight: 100,
            weightUnit: 'lb',
            reps: 5,
            restSeconds: null,
            note: '带,逗号"引号',
            completed: true,
            createdAt: CREATED_AT,
          },
        ],
      },
    ],
  };
}

function main(): void {
  const snapshot = makeSnapshot();

  // ---------------------------------------------------------------- 校验
  section('[1] 校验：合法备份');
  const ok = validateBackup(JSON.parse(toBackupJson(snapshot)) as unknown);
  check('合法备份通过校验', ok.ok);
  check(
    '通过后拿到的训练与组都完整',
    ok.ok && ok.snapshot.data.workouts[0]?.exercises[0]?.sets.length === 2,
    ok.ok ? ok.snapshot.data.workouts.length : null,
  );

  section('[2] 校验：坏文件要说清楚哪里不对');
  const notJson = parseBackupText('{ 这不是 JSON');
  check('非法 JSON 被挡下', !notJson.ok);
  check(
    '提示里说明是 JSON 解析失败',
    !notJson.ok && notJson.errors[0]?.includes('JSON') === true,
    notJson.ok ? null : notJson.errors,
  );

  const wrongFormat = validateBackup({ ...snapshot, format: 'other-app' });
  check(
    'format 不对时提示这不是 FitLog 备份',
    !wrongFormat.ok && wrongFormat.errors[0]?.includes(BACKUP_FORMAT) === true,
    wrongFormat.ok ? null : wrongFormat.errors,
  );

  const futureVersion = validateBackup({ ...snapshot, version: BACKUP_VERSION + 10 });
  check(
    '版本比当前 App 新时拒绝导入并说明原因',
    !futureVersion.ok && futureVersion.errors[0]?.includes('更新') === true,
    futureVersion.ok ? null : futureVersion.errors,
  );

  const badMuscles = validateBackup({ ...snapshot, data: { ...snapshot.data, muscles: '胸' } });
  check(
    'data.muscles 不是数组时提示字段路径',
    !badMuscles.ok && badMuscles.errors[0] === 'data.muscles 必须是数组',
    badMuscles.ok ? null : badMuscles.errors,
  );

  const badWeight: unknown = JSON.parse(JSON.stringify(snapshot)) as unknown;
  if (
    typeof badWeight === 'object' &&
    badWeight !== null &&
    'data' in badWeight &&
    typeof (badWeight as { data: unknown }).data === 'object'
  ) {
    const data = (
      badWeight as { data: { workouts: { exercises: { sets: { weight: unknown }[] }[] }[] } }
    ).data;
    const firstSet = data.workouts[0]?.exercises[0]?.sets[0];
    if (firstSet) firstSet.weight = '80';
  }
  const badWeightResult = validateBackup(badWeight);
  check(
    '某组重量不是数字时提示精确到那一组',
    !badWeightResult.ok &&
      badWeightResult.errors[0] === 'data.workouts[0].exercises[0].sets[0].weight 必须是数字',
    badWeightResult.ok ? null : badWeightResult.errors,
  );

  const badDate: unknown = JSON.parse(JSON.stringify(snapshot)) as unknown;
  if (typeof badDate === 'object' && badDate !== null && 'data' in badDate) {
    const data = (badDate as { data: { workouts: { date: string }[] } }).data;
    const firstWorkout = data.workouts[0];
    if (firstWorkout) firstWorkout.date = '2026-02-30';
  }
  const badDateResult = validateBackup(badDate);
  check(
    '不存在的日期（2 月 30 日）被挡下',
    !badDateResult.ok && badDateResult.errors[0]?.includes('不存在') === true,
    badDateResult.ok ? null : badDateResult.errors,
  );

  // ---------------------------------------------------------------- 计数
  section('[3] 计数与摘要');
  const counts = countBackup(snapshot.data);
  check(
    '部位 2 / 动作 2 / 补剂 1 / 记录 1',
    counts.muscles === 2 &&
      counts.exercises === 2 &&
      counts.supplements === 1 &&
      counts.supplementRecords === 1,
    counts,
  );
  check(
    '训练 1 次、动作 1 个、组 2 组',
    counts.workouts === 1 && counts.workoutExercises === 1 && counts.workoutSets === 2,
    counts,
  );
  check(
    '摘要把各类数据都写清楚',
    describeCounts(counts).includes('1 次训练'),
    describeCounts(counts),
  );
  check('空库的摘要是「暂无数据」', describeCounts(countBackup(emptyData())) === '暂无数据');

  // ---------------------------------------------------------------- CSV
  section('[4] CSV：表头、kg 换算、转义');
  const csv = serializeWorkoutSetsCsv([makeWorkoutDetail()]);
  const lines = csv.split('\r\n');
  check('前置 BOM（Excel 打开中文不乱码）', csv.startsWith('\ufeff'));
  check(
    '第一行是表头',
    lines[0]?.includes('训练日期') === true && lines[0]?.includes('本组训练量(kg)') === true,
    lines[0],
  );
  check(
    '一行 = 一组（表头 + 2 行）',
    lines.filter((line) => line !== '').length === 3,
    lines.length,
  );
  check('kg 组按原值输出', lines[1]?.includes(',80,kg,10,90,800,') === true, lines[1]);
  check('lb 组换算成 kg：100lb × 5 = 226.8kg', lines[2]?.includes('226.8') === true, lines[2]);
  check('带逗号和引号的备注被正确转义', lines[2]?.includes('"带,逗号""引号"') === true, lines[2]);
  check(
    '动作备注与训练备注也在同一行里',
    lines[2]?.includes('肩膀有点紧') === true && lines[2]?.includes('状态不错') === true,
    lines[2],
  );

  // ---------------------------------------------------------------- 导入
  section('[5] 导入：空库全量导入');
  const first = planImport(emptyData(), snapshot.data);
  check(
    '新增 10 条（2 部位 + 2 动作 + 1 补剂 + 1 记录 + 1 训练 + 1 动作 + 2 组）',
    first.result.addedTotal === 10,
    first.result,
  );
  check('没有跳过任何东西', first.result.skippedTotal === 0, first.result.skippedTotal);
  check('没有告警', first.result.warnings.length === 0, first.result.warnings);
  check(
    '摘要两行：新增 + 跳过重复',
    describeImportResult(first.result).length === 2,
    describeImportResult(first.result),
  );

  section('[6] 导入：同一份导两次不产生重复');
  const afterFirst = planToData(first);
  const second = planImport(afterFirst, snapshot.data);
  check('第二次新增 0 条', second.result.addedTotal === 0, second.result);
  check('第二次跳过 10 条', second.result.skippedTotal === 10, second.result.skippedTotal);
  check('第二次没有任何要写入的行', second.muscles.length === 0 && second.workouts.length === 0);

  section('[7] 导入：跨设备 id 不同 → 按名字合并引用');
  const localData: BackupData = {
    ...emptyData(),
    muscles: [{ id: 'm_local', name: '胸', sortOrder: 1 }],
    exercises: [
      {
        id: 'e_local',
        name: '杠铃卧推',
        muscleId: 'm_local',
        description: null,
        isCustom: false,
        sortOrder: 0,
      },
    ],
  };
  const merged = planImport(localData, snapshot.data);
  check(
    '已有的「胸」不会被再加一遍',
    merged.muscles.every((muscle) => muscle.name !== '胸'),
    merged.muscles,
  );
  check(
    '已有的「杠铃卧推」不会被再加一遍',
    merged.exercises.every((exercise) => exercise.name !== '杠铃卧推'),
    merged.exercises,
  );
  check(
    '导入的动作挂到了本机已有的「胸」上',
    merged.exercises.every((exercise) => exercise.muscleId !== 'm1'),
    merged.exercises.map((exercise) => exercise.muscleId),
  );
  check(
    '训练里的动作改指向本机已有的动作 id',
    merged.workoutExercises[0]?.exerciseId === 'e_local',
    merged.workoutExercises[0]?.exerciseId,
  );
  check(
    '训练里的动作也挂到本机已有的部位 id',
    merged.workoutExercises[0]?.muscleId === 'm_local',
    merged.workoutExercises[0]?.muscleId,
  );
  check(
    '「背 / 引体向上」这种本机没有的照常导入',
    merged.exercises.length === 1 && merged.exercises[0]?.name === '引体向上',
    merged.exercises,
  );

  section('[8] 导入：重复的训练按「日期 + 开始时间」跳过');
  const sameWorkoutDifferentId: BackupData = {
    ...emptyData(),
    workouts: [{ ...(snapshot.data.workouts[0] as BackupWorkout), id: 'w_other' }],
  };
  const reImported = planImport(sameWorkoutDifferentId, snapshot.data);
  check(
    '同一天同一时间开始的训练被认成同一次',
    reImported.result.workouts.skipped === 1,
    reImported.result.workouts,
  );
  check(
    '它的动作和组也不会重复写入',
    reImported.workoutExercises.length === 0 && reImported.workoutSets.length === 0,
  );

  section('[9] 导入：引用的数据在本机不存在时给出告警但不丢历史');
  const dangling: BackupData = {
    ...emptyData(),
    workouts: [
      {
        ...(snapshot.data.workouts[0] as BackupWorkout),
        id: 'w_dangling',
        exercises: [
          {
            ...(snapshot.data.workouts[0] as BackupWorkout).exercises[0]!,
            id: 'we_dangling',
            exerciseId: 'e_missing',
            muscleId: 'm_missing',
            sets: [],
          },
        ],
      },
    ],
  };
  const danglingPlan = planImport(emptyData(), dangling);
  check('训练仍然被导入', danglingPlan.workouts.length === 1, danglingPlan.workouts.length);
  check(
    '保留了当时的动作名（历史不丢）',
    danglingPlan.workoutExercises[0]?.exerciseName === '杠铃卧推',
    danglingPlan.workoutExercises[0]?.exerciseName,
  );
  check(
    '给出了「引用的动作不存在」的告警',
    danglingPlan.result.warnings.some((warning) => warning.includes('训练动作')),
    danglingPlan.result.warnings,
  );

  section('[10] 补剂的可选单位（g / 勺）');
  const withUnits = makeSnapshot();
  withUnits.data.supplements = [
    { id: 'sup1', name: '蛋白粉', unit: 'g', units: ['g', '勺'], isDefault: true, sortOrder: 0 },
  ];
  const unitsResult = validateBackup(JSON.parse(toBackupJson(withUnits)) as unknown);
  check('备份里的可选单位能通过校验', unitsResult.ok);
  check(
    '可选单位原样保留（g / 勺）',
    unitsResult.ok && unitsResult.snapshot.data.supplements[0]?.units.join('/') === 'g/勺',
    unitsResult.ok ? unitsResult.snapshot.data.supplements[0]?.units : null,
  );

  const legacyResult = validateBackup(JSON.parse(toBackupJson(makeSnapshot())) as unknown);
  check(
    '老备份没有 units 字段时按原来的单位兜底',
    legacyResult.ok && legacyResult.snapshot.data.supplements[0]?.units.join('/') === 'g',
    legacyResult.ok ? legacyResult.snapshot.data.supplements[0]?.units : null,
  );

  const badUnitsSnapshot = makeSnapshot();
  badUnitsSnapshot.data.supplements = [
    { id: 'sup1', name: '蛋白粉', unit: 'g', units: ['g', ''], isDefault: true, sortOrder: 0 },
  ];
  const badUnitsResult = validateBackup(JSON.parse(toBackupJson(badUnitsSnapshot)) as unknown);
  check(
    'units 里有空字符串时提示到字段路径',
    !badUnitsResult.ok && badUnitsResult.errors[0]?.includes('units') === true,
    badUnitsResult.ok ? null : badUnitsResult.errors,
  );

  console.log('');
  if (failures > 0) {
    console.error(`失败：${checks - failures}/${checks} 项通过，${failures} 项未通过。\n`);
    process.exitCode = 1;
  } else {
    console.log(`备份单元测试全部通过（${checks}/${checks}）。\n`);
  }
}

main();
