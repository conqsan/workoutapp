/**
 * FitLog 冒烟测试。
 *
 * 直接构建 Fastify 应用并用 app.inject() 发请求，不需要真的监听端口，
 * 因此可以一键运行：`npm test`（在仓库根目录或 backend/ 下）。
 *
 * 覆盖范围：
 *   Phase 1 - 健康检查契约、统一 404、非法 JSON 的可读错误提示
 *   Phase 2 - 基础数据 API（部位 / 动作 / 补剂）的读、增、改、删与校验
 *
 * 注意：测试会真的写数据库，但用的是唯一命名的临时记录，跑完会自己删干净。
 */

import { buildApp } from '../src/app';
import { disconnectDatabase } from '../src/config/prisma';
import type {
  ExerciseDto,
  HealthPayload,
  LastWorkoutDto,
  MuscleDto,
  SupplementRecordDto,
  SupplementDto,
  WorkoutDto,
} from '../src/types/api';

const DEFAULT_MUSCLE_NAMES = ['胸', '背', '肩', '二头', '三头', '腿', '臀', '腹', '全身', '其他'];

const DEFAULT_SUPPLEMENT_NAMES = ['增肌粉', '肌酸', '蛋白粉'];

/** 每次运行都不同的名字，避免和上一次的残留冲突 */
const RUN_ID = Date.now().toString(36);
const TEMP_EXERCISE_NAME = `冒烟测试动作-${RUN_ID}`;
const TEMP_SUPPLEMENT_NAME = `冒烟测试补剂-${RUN_ID}`;

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, extra?: unknown): void {
  checks += 1;
  if (condition) {
    console.log(`  \u2713 ${name}`);
  } else {
    failures += 1;
    console.error(`  \u2717 ${name}`);
    if (extra !== undefined) {
      console.error('    实际结果:', JSON.stringify(extra, null, 2));
    }
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** 本地时区的今天，用于和接口返回的 date 对比 */
function localDateKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

interface SuccessBody<TData> {
  success: boolean;
  data: TData;
}

interface ErrorBody {
  success: boolean;
  error?: { code?: string; message?: string };
}

async function main(): Promise<void> {
  const app = await buildApp();

  // ---------------------------------------------------------------- Phase 1
  section('[1] GET /api/health');
  const healthRes = await app.inject({ method: 'GET', url: '/api/health' });
  const health = healthRes.json<SuccessBody<HealthPayload>>();

  check('HTTP 200', healthRes.statusCode === 200, healthRes.statusCode);
  check('success = true', health.success === true, health);
  check('service = fitlog-backend', health.data?.service === 'fitlog-backend', health.data);
  check('timestamp 是合法 ISO 时间', !Number.isNaN(Date.parse(health.data?.timestamp ?? '')));

  section('[2] 数据库已初始化（Phase 2 的关键变化）');
  const database = health.data?.database;
  check('database.configured = true', database?.configured === true, database);
  check(
    'database.initialized = true（Prisma Client 已生成且能查询）',
    database?.initialized === true,
    database,
  );
  check('status = ok', health.data?.status === 'ok', health.data);

  // ---------------------------------------------------------------- Phase 2
  section('[3] GET /api/muscles —— 训练部位');
  const muscleRes = await app.inject({ method: 'GET', url: '/api/muscles' });
  const muscles = muscleRes.json<SuccessBody<MuscleDto[]>>();

  check('HTTP 200', muscleRes.statusCode === 200, muscleRes.statusCode);
  check('返回 10 个默认部位（小腿已移除）', muscles.data?.length === 10, muscles.data?.length);
  check(
    '10 个默认部位名称与顺序正确',
    JSON.stringify(muscles.data?.map((m) => m.name)) === JSON.stringify(DEFAULT_MUSCLE_NAMES),
    muscles.data?.map((m) => m.name),
  );
  check(
    'sortOrder 递增',
    (muscles.data ?? []).every(
      (m, i, arr) => i === 0 || m.sortOrder >= (arr[i - 1]?.sortOrder ?? 0),
    ),
    muscles.data?.map((m) => m.sortOrder),
  );

  const chest = muscles.data?.find((m) => m.name === '胸');
  const back = muscles.data?.find((m) => m.name === '背');
  check('存在「胸」部位', chest !== undefined, chest);

  section('[4] GET /api/exercises —— 训练动作');
  const exerciseRes = await app.inject({ method: 'GET', url: '/api/exercises' });
  const exercises = exerciseRes.json<SuccessBody<ExerciseDto[]>>();

  check('HTTP 200', exerciseRes.statusCode === 200, exerciseRes.statusCode);
  check('默认动作已 seed（46 个）', exercises.data?.length === 46, exercises.data?.length);
  check(
    '包含「胸 / 杠铃卧推」',
    (exercises.data ?? []).some((e) => e.name === '杠铃卧推' && e.muscle.name === '胸'),
    exercises.data?.slice(0, 3),
  );
  check(
    '「双杠臂屈伸」在胸和三头各有一条（同名不同部位）',
    (exercises.data ?? []).filter((e) => e.name === '双杠臂屈伸').length === 2,
    (exercises.data ?? []).filter((e) => e.name === '双杠臂屈伸').map((e) => e.muscle.name),
  );
  check(
    '默认动作 isCustom = false',
    (exercises.data ?? []).every((e) => e.isCustom === false),
    (exercises.data ?? []).filter((e) => e.isCustom).map((e) => e.name),
  );
  check(
    '每个动作都带上了所属部位信息',
    (exercises.data ?? []).every(
      (e) => typeof e.muscle?.name === 'string' && e.muscle.name.length > 0,
    ),
    (exercises.data ?? []).find((e) => !e.muscle),
  );

  section('[5] GET /api/exercises?muscleId= —— 按部位过滤');
  const chestRes = await app.inject({
    method: 'GET',
    url: `/api/exercises?muscleId=${chest?.id ?? 0}`,
  });
  const chestExercises = chestRes.json<SuccessBody<ExerciseDto[]>>();

  check('HTTP 200', chestRes.statusCode === 200, chestRes.statusCode);
  check(
    '只返回胸部的动作（10 个）',
    chestExercises.data?.length === 10,
    chestExercises.data?.length,
  );
  check(
    '全部属于「胸」',
    (chestExercises.data ?? []).every((e) => e.muscleId === chest?.id),
    chestExercises.data?.map((e) => e.muscle.name),
  );

  section('[6] GET /api/supplements —— 补剂');
  const supplementRes = await app.inject({ method: 'GET', url: '/api/supplements' });
  const supplements = supplementRes.json<SuccessBody<SupplementDto[]>>();

  check('HTTP 200', supplementRes.statusCode === 200, supplementRes.statusCode);
  check(
    '包含 3 个默认补剂',
    DEFAULT_SUPPLEMENT_NAMES.every((name) => (supplements.data ?? []).some((s) => s.name === name)),
    supplements.data?.map((s) => s.name),
  );
  check(
    '默认补剂 isDefault = true 且单位是 g',
    DEFAULT_SUPPLEMENT_NAMES.every((name) =>
      (supplements.data ?? []).some((s) => s.name === name && s.isDefault && s.unit === 'g'),
    ),
    supplements.data,
  );

  section('[7] POST /api/exercises —— 创建自定义动作');
  const createExerciseRes = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    payload: { name: TEMP_EXERCISE_NAME, muscleId: back?.id, description: '  冒烟测试创建  ' },
  });
  const createdExercise = createExerciseRes.json<SuccessBody<ExerciseDto>>();
  const createdExerciseId = createdExercise.data?.id;

  check('HTTP 201', createExerciseRes.statusCode === 201, createExerciseRes.statusCode);
  check('返回了 id', typeof createdExerciseId === 'number', createdExercise);
  check('isCustom = true', createdExercise.data?.isCustom === true, createdExercise.data);
  check(
    'description 已 trim',
    createdExercise.data?.description === '冒烟测试创建',
    createdExercise.data,
  );
  check('带上了所属部位', createdExercise.data?.muscle?.id === back?.id, createdExercise.data);

  section('[8] PUT /api/exercises/:id —— 修改动作');
  const updateExerciseRes = await app.inject({
    method: 'PUT',
    url: `/api/exercises/${createdExerciseId ?? 0}`,
    payload: { name: `${TEMP_EXERCISE_NAME}-改`, description: '' },
  });
  const updatedExercise = updateExerciseRes.json<SuccessBody<ExerciseDto>>();

  check('HTTP 200', updateExerciseRes.statusCode === 200, updateExerciseRes.statusCode);
  check(
    '名称已更新',
    updatedExercise.data?.name === `${TEMP_EXERCISE_NAME}-改`,
    updatedExercise.data,
  );
  check('空描述被清成 null', updatedExercise.data?.description === null, updatedExercise.data);
  check('isCustom 保持不变', updatedExercise.data?.isCustom === true, updatedExercise.data);

  section('[9] 参数校验与重复提交');
  const duplicateRes = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    payload: { name: '杠铃卧推', muscleId: chest?.id },
  });
  const duplicateBody = duplicateRes.json<ErrorBody>();
  check('同部位同名动作 -> 409', duplicateRes.statusCode === 409, duplicateRes.statusCode);
  check(
    '给出可读中文提示',
    (duplicateBody.error?.message ?? '').includes('同名动作'),
    duplicateBody,
  );

  const badMuscleRes = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    payload: { name: `坏部位-${RUN_ID}`, muscleId: 999999 },
  });
  check(
    '部位不存在 -> 4xx',
    badMuscleRes.statusCode >= 400 && badMuscleRes.statusCode < 500,
    badMuscleRes.statusCode,
  );

  const emptyNameRes = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    payload: { name: '   ', muscleId: back?.id },
  });
  const emptyNameBody = emptyNameRes.json<ErrorBody>();
  check('空名称 -> 422', emptyNameRes.statusCode === 422, emptyNameRes.statusCode);
  check('提示语是中文', /不能为空/.test(emptyNameBody.error?.message ?? ''), emptyNameBody);

  const badIdRes = await app.inject({
    method: 'PUT',
    url: '/api/exercises/999999',
    payload: { name: 'x' },
  });
  check('修改不存在的动作 -> 404', badIdRes.statusCode === 404, badIdRes.statusCode);

  section('[10] DELETE /api/exercises/:id —— 删除动作');
  const deleteExerciseRes = await app.inject({
    method: 'DELETE',
    url: `/api/exercises/${createdExerciseId ?? 0}`,
  });
  check('HTTP 200', deleteExerciseRes.statusCode === 200, deleteExerciseRes.statusCode);

  const afterDeleteRes = await app.inject({
    method: 'GET',
    url: `/api/exercises/${createdExerciseId ?? 0}`,
  });
  check('删除后该动作 -> 404', afterDeleteRes.statusCode === 404, afterDeleteRes.statusCode);

  section('[11] 补剂增删改');
  const createSupplementRes = await app.inject({
    method: 'POST',
    url: '/api/supplements',
    payload: { name: TEMP_SUPPLEMENT_NAME, unit: 'ml' },
  });
  const createdSupplement = createSupplementRes.json<SuccessBody<SupplementDto>>();
  const createdSupplementId = createdSupplement.data?.id;

  check('HTTP 201', createSupplementRes.statusCode === 201, createSupplementRes.statusCode);
  check(
    '自定义补剂 isDefault = false',
    createdSupplement.data?.isDefault === false,
    createdSupplement.data,
  );
  check('单位已保存', createdSupplement.data?.unit === 'ml', createdSupplement.data);

  const duplicateSupplementRes = await app.inject({
    method: 'POST',
    url: '/api/supplements',
    payload: { name: '肌酸' },
  });
  check(
    '重名补剂 -> 409',
    duplicateSupplementRes.statusCode === 409,
    duplicateSupplementRes.statusCode,
  );

  const updateSupplementRes = await app.inject({
    method: 'PUT',
    url: `/api/supplements/${createdSupplementId ?? 0}`,
    payload: { unit: 'g' },
  });
  check(
    '修改补剂单位',
    updateSupplementRes.statusCode === 200 &&
      updateSupplementRes.json<SuccessBody<SupplementDto>>().data?.unit === 'g',
    updateSupplementRes.json(),
  );

  const deleteSupplementRes = await app.inject({
    method: 'DELETE',
    url: `/api/supplements/${createdSupplementId ?? 0}`,
  });
  check('删除补剂 -> 200', deleteSupplementRes.statusCode === 200, deleteSupplementRes.statusCode);

  const supplementsAfterRes = await app.inject({ method: 'GET', url: '/api/supplements' });
  check(
    '删除后列表里不再出现',
    !(supplementsAfterRes.json<SuccessBody<SupplementDto[]>>().data ?? []).some(
      (s) => s.id === createdSupplementId,
    ),
    supplementsAfterRes.json(),
  );

  // ---------------------------------------------------------------- Phase 3
  section('[12] 训练记录：按 Phase 3 验收脚本完整走一遍');

  // 先清理上次跑崩留下的进行中训练，让测试可重复执行
  const strayRes = await app.inject({ method: 'GET', url: '/api/workouts/active' });
  const stray = strayRes.json<SuccessBody<WorkoutDto | null>>().data;
  if (stray) {
    await app.inject({ method: 'DELETE', url: `/api/workouts/${stray.id}` });
  }

  const findExercise = (name: string): ExerciseDto | undefined =>
    (exercises.data ?? []).find((e) => e.name === name);
  const benchPress = findExercise('杠铃卧推');
  const inclineDumbbell = findExercise('上斜哑铃卧推');
  const lateralRaise = findExercise('哑铃侧平举');

  check(
    '三个验收动作都存在（杠铃卧推 / 上斜哑铃卧推 / 哑铃侧平举）',
    benchPress !== undefined && inclineDumbbell !== undefined && lateralRaise !== undefined,
    [benchPress?.name, inclineDumbbell?.name, lateralRaise?.name],
  );

  const startRes = await app.inject({ method: 'POST', url: '/api/workouts', payload: {} });
  const started = startRes.json<SuccessBody<WorkoutDto>>().data;
  const workoutId = started?.id;

  check('开始训练 -> 201', startRes.statusCode === 201, startRes.statusCode);
  check('status = active', started?.status === 'active', started?.status);
  check('有开始时间', typeof started?.startTime === 'string', started?.startTime);
  check('日期是今天', started?.date === localDateKey(), started?.date);

  const duplicateStartRes = await app.inject({ method: 'POST', url: '/api/workouts', payload: {} });
  const duplicateStartBody = duplicateStartRes.json<ErrorBody>();
  check('重复开始训练 -> 409', duplicateStartRes.statusCode === 409, duplicateStartRes.statusCode);
  check(
    '409 里带上已有训练 id，前端可以跳过去',
    (duplicateStartBody as { error?: { details?: { workoutId?: number } } }).error?.details
      ?.workoutId === workoutId,
    duplicateStartBody,
  );

  // 加动作：胸 + 肩
  for (const exercise of [benchPress, inclineDumbbell, lateralRaise]) {
    await app.inject({
      method: 'POST',
      url: `/api/workouts/${workoutId ?? 0}/exercises`,
      payload: { exerciseId: exercise?.id },
    });
  }

  let currentRes = await app.inject({ method: 'GET', url: `/api/workouts/${workoutId ?? 0}` });
  let current = currentRes.json<SuccessBody<WorkoutDto>>().data;

  check('训练里已加入 3 个动作', current?.exercises.length === 3, current?.exercises.length);
  check(
    '动作顺序与添加顺序一致',
    (current?.exercises ?? []).map((e) => e.exercise.name).join(',') ===
      ['杠铃卧推', '上斜哑铃卧推', '哑铃侧平举'].join(','),
    (current?.exercises ?? []).map((e) => e.exercise.name),
  );
  check(
    '训练部位是 胸 + 肩',
    Array.from(new Set((current?.exercises ?? []).map((e) => e.exercise.muscle.name)))
      .sort()
      .join('+') === '肩+胸',
    (current?.exercises ?? []).map((e) => e.exercise.muscle.name),
  );

  // 逐组录入：卧推 80×10 / 80×8 / 75×10，上斜哑铃卧推 30×10 / 30×8，侧平举 10×12 / 10×12 / 10×10
  const SET_PLAN: Array<[string, Array<[number, number]>]> = [
    [
      '杠铃卧推',
      [
        [80, 10],
        [80, 8],
        [75, 10],
      ],
    ],
    [
      '上斜哑铃卧推',
      [
        [30, 10],
        [30, 8],
      ],
    ],
    [
      '哑铃侧平举',
      [
        [10, 12],
        [10, 12],
        [10, 10],
      ],
    ],
  ];

  for (const [exerciseName, sets] of SET_PLAN) {
    const target = (current?.exercises ?? []).find((e) => e.exercise.name === exerciseName);
    for (const [weight, reps] of sets) {
      await app.inject({
        method: 'POST',
        url: `/api/workout-exercises/${target?.id ?? 0}/sets`,
        payload: { weight, reps, restSeconds: 90 },
      });
    }
  }

  currentRes = await app.inject({ method: 'GET', url: `/api/workouts/${workoutId ?? 0}` });
  current = currentRes.json<SuccessBody<WorkoutDto>>().data;

  const bench = (current?.exercises ?? []).find((e) => e.exercise.name === '杠铃卧推');
  check('卧推有 3 组', bench?.sets.length === 3, bench?.sets.length);
  check(
    '卧推每组数据正确（80×10 / 80×8 / 75×10），组号连续',
    JSON.stringify(bench?.sets.map((s) => [s.setNumber, s.weight, s.reps])) ===
      JSON.stringify([
        [1, 80, 10],
        [2, 80, 8],
        [3, 75, 10],
      ]),
    bench?.sets.map((s) => [s.setNumber, s.weight, s.reps]),
  );
  check(
    '每组单独一行保存（没有被压成一个字段）',
    (current?.exercises ?? []).every((e) => Array.isArray(e.sets) && e.sets.length > 0),
    (current?.exercises ?? []).map((e) => e.sets.length),
  );
  check('总组数 8', current?.totalSets === 8, current?.totalSets);
  check('训练总量 = Σ(weight × reps) = 3070', current?.totalVolume === 3070, current?.totalVolume);
  check('休息时间已保存', bench?.sets[0]?.restSeconds === 90, bench?.sets[0]?.restSeconds);

  section('[13] 刷新 / 重新进入后数据仍然存在');
  const reentryRes = await app.inject({ method: 'GET', url: `/api/workouts/${workoutId ?? 0}` });
  const reentry = reentryRes.json<SuccessBody<WorkoutDto>>().data;
  check(
    '重新拉取到的数据和刚才完全一致',
    JSON.stringify(reentry) === JSON.stringify(current),
    reentry,
  );

  const activeRes = await app.inject({ method: 'GET', url: '/api/workouts/active' });
  check(
    'GET /api/workouts/active 能找回进行中的训练（前端刷新后接着练）',
    activeRes.json<SuccessBody<WorkoutDto | null>>().data?.id === workoutId,
    activeRes.json(),
  );

  section('[14] 复制上一组 / 修改组 / 删除组');
  const lastBenchSet = bench?.sets[bench.sets.length - 1];
  const copyRes = await app.inject({
    method: 'POST',
    url: `/api/workout-exercises/${bench?.id ?? 0}/sets`,
    payload: { weight: lastBenchSet?.weight, reps: lastBenchSet?.reps },
  });
  const afterCopy = copyRes.json<SuccessBody<WorkoutDto>>().data;
  const benchAfterCopy = (afterCopy?.exercises ?? []).find((e) => e.exercise.name === '杠铃卧推');

  check('复制上一组 -> 201', copyRes.statusCode === 201, copyRes.statusCode);
  check(
    '复制后重量和次数与上一组一致',
    benchAfterCopy?.sets[3]?.weight === lastBenchSet?.weight &&
      benchAfterCopy?.sets[3]?.reps === lastBenchSet?.reps,
    benchAfterCopy?.sets[3],
  );
  check(
    '复制后组号为 4',
    benchAfterCopy?.sets[3]?.setNumber === 4,
    benchAfterCopy?.sets[3]?.setNumber,
  );

  const copiedSetId = benchAfterCopy?.sets[3]?.id;
  const deleteSetRes = await app.inject({ method: 'DELETE', url: `/api/sets/${copiedSetId ?? 0}` });
  const afterDeleteSet = deleteSetRes.json<SuccessBody<WorkoutDto>>().data;
  const benchAfterDelete = (afterDeleteSet?.exercises ?? []).find(
    (e) => e.exercise.name === '杠铃卧推',
  );

  check('删除组 -> 200', deleteSetRes.statusCode === 200, deleteSetRes.statusCode);
  check('删除后剩 3 组', benchAfterDelete?.sets.length === 3, benchAfterDelete?.sets.length);
  check(
    '组号重新压成 1/2/3，没有断号',
    benchAfterDelete?.sets.map((s) => s.setNumber).join(',') === '1,2,3',
    benchAfterDelete?.sets.map((s) => s.setNumber),
  );
  check('总量回到 3070', afterDeleteSet?.totalVolume === 3070, afterDeleteSet?.totalVolume);

  const thirdLateralSet = (current?.exercises ?? []).find((e) => e.exercise.name === '哑铃侧平举')
    ?.sets[2];
  const updateSetRes = await app.inject({
    method: 'PUT',
    url: `/api/sets/${thirdLateralSet?.id ?? 0}`,
    payload: { weight: 12.5, reps: 10, note: '最后一组加重' },
  });
  const afterUpdateSet = updateSetRes.json<SuccessBody<WorkoutDto>>().data;
  const lateralAfterUpdate = (afterUpdateSet?.exercises ?? []).find(
    (e) => e.exercise.name === '哑铃侧平举',
  );

  check('修改组 -> 200', updateSetRes.statusCode === 200, updateSetRes.statusCode);
  check(
    '重量已更新为 12.5',
    lateralAfterUpdate?.sets[2]?.weight === 12.5,
    lateralAfterUpdate?.sets[2],
  );
  check(
    '备注已保存',
    lateralAfterUpdate?.sets[2]?.note === '最后一组加重',
    lateralAfterUpdate?.sets[2],
  );
  check('总量随之更新 = 3095', afterUpdateSet?.totalVolume === 3095, afterUpdateSet?.totalVolume);

  section('[15] 重量单位 kg / lb');
  const benchForUnit = (afterUpdateSet?.exercises ?? []).find(
    (e) => e.exercise.name === '杠铃卧推',
  );
  const lbSetRes = await app.inject({
    method: 'POST',
    url: `/api/workout-exercises/${benchForUnit?.id ?? 0}/sets`,
    payload: { weight: 100, weightUnit: 'lb', reps: 5 },
  });
  const afterLb = lbSetRes.json<SuccessBody<WorkoutDto>>().data;
  const lbSet = (afterLb?.exercises ?? []).find((e) => e.exercise.name === '杠铃卧推')?.sets.at(-1);

  check('用 lb 记账 -> 201', lbSetRes.statusCode === 201, lbSetRes.statusCode);
  check('这一组记下了单位 lb', lbSet?.weightUnit === 'lb', lbSet);
  check('数字按原样保存（100 lb 不会变成 100 kg）', lbSet?.weight === 100, lbSet);
  check(
    '训练总量把 lb 换算成 kg 之后再累加（3095 + 100lb×5 = 3321.8kg）',
    Math.abs((afterLb?.totalVolume ?? 0) - (3095 + 100 * 0.45359237 * 5)) < 0.01,
    afterLb?.totalVolume,
  );

  const invalidUnitRes = await app.inject({
    method: 'POST',
    url: `/api/workout-exercises/${benchForUnit?.id ?? 0}/sets`,
    payload: { weight: 100, weightUnit: 'stone', reps: 5 },
  });
  check('非法单位 -> 422', invalidUnitRes.statusCode === 422, invalidUnitRes.statusCode);

  const defaultUnitRes = await app.inject({
    method: 'POST',
    url: `/api/workout-exercises/${benchForUnit?.id ?? 0}/sets`,
    payload: { weight: 60, reps: 10 },
  });
  const defaultUnitSet = defaultUnitRes
    .json<SuccessBody<WorkoutDto>>()
    .data?.exercises.find((e) => e.exercise.name === '杠铃卧推')
    ?.sets.at(-1);
  check('不传单位时默认 kg', defaultUnitSet?.weightUnit === 'kg', defaultUnitSet);

  // 把刚才加的两组删掉，恢复成后面断言依赖的状态
  await app.inject({ method: 'DELETE', url: `/api/sets/${lbSet?.id ?? 0}` });
  const restoredRes = await app.inject({
    method: 'DELETE',
    url: `/api/sets/${defaultUnitSet?.id ?? 0}`,
  });
  const restored = restoredRes.json<SuccessBody<WorkoutDto>>().data;
  check(
    '删掉这两组后总量回到 3095',
    Math.abs((restored?.totalVolume ?? 0) - 3095) < 0.01,
    restored?.totalVolume,
  );

  section('[16] 调整动作顺序 / 删除动作');
  const exerciseIds = (afterUpdateSet?.exercises ?? []).map((e) => e.id);
  const reversed = [...exerciseIds].reverse();
  const reorderRes = await app.inject({
    method: 'PUT',
    url: `/api/workouts/${workoutId ?? 0}/exercises/reorder`,
    payload: { orderedIds: reversed },
  });
  const afterReorder = reorderRes.json<SuccessBody<WorkoutDto>>().data;
  check('调整顺序 -> 200', reorderRes.statusCode === 200, reorderRes.statusCode);
  check(
    '顺序已反转，且 sortOrder 变成 0/1/2',
    JSON.stringify((afterReorder?.exercises ?? []).map((e) => e.id)) === JSON.stringify(reversed) &&
      (afterReorder?.exercises ?? []).every((e, i) => e.sortOrder === i),
    (afterReorder?.exercises ?? []).map((e) => [e.id, e.sortOrder]),
  );

  const badReorderRes = await app.inject({
    method: 'PUT',
    url: `/api/workouts/${workoutId ?? 0}/exercises/reorder`,
    payload: { orderedIds: [exerciseIds[0]] },
  });
  check('排序列表不完整 -> 400', badReorderRes.statusCode === 400, badReorderRes.statusCode);

  const inclineEntry = (afterReorder?.exercises ?? []).find(
    (e) => e.exercise.name === '上斜哑铃卧推',
  );
  const deleteExerciseEntryRes = await app.inject({
    method: 'DELETE',
    url: `/api/workout-exercises/${inclineEntry?.id ?? 0}`,
  });
  check(
    '删除训练里的动作 -> 200',
    deleteExerciseEntryRes.statusCode === 200,
    deleteExerciseEntryRes.statusCode,
  );

  const afterDeleteEntry = deleteExerciseEntryRes.json<SuccessBody<WorkoutDto>>().data;
  check(
    '剩 2 个动作',
    afterDeleteEntry?.exercises.length === 2,
    afterDeleteEntry?.exercises.length,
  );
  check(
    '删动作会连它的组一起删掉（剩 6 组）',
    afterDeleteEntry?.totalSets === 6,
    afterDeleteEntry?.totalSets,
  );
  check('总量更新 = 2555', afterDeleteEntry?.totalVolume === 2555, afterDeleteEntry?.totalVolume);
  const inclineStillExistsRes = await app.inject({
    method: 'GET',
    url: `/api/exercises/${inclineDumbbell?.id ?? 0}`,
  });
  check(
    '默认动作本身没有被删掉（只删了这次训练里的引用）',
    inclineStillExistsRes.statusCode === 200,
    inclineStillExistsRes.statusCode,
  );

  section('[17] 参数校验');
  const benchEntry = (afterDeleteEntry?.exercises ?? []).find(
    (e) => e.exercise.name === '杠铃卧推',
  );
  const negativeWeightRes = await app.inject({
    method: 'POST',
    url: `/api/workout-exercises/${benchEntry?.id ?? 0}/sets`,
    payload: { weight: -5, reps: 10 },
  });
  check('重量为负 -> 422', negativeWeightRes.statusCode === 422, negativeWeightRes.statusCode);
  check(
    '提示语说明是重量问题',
    /重量/.test(negativeWeightRes.json<ErrorBody>().error?.message ?? ''),
    negativeWeightRes.json(),
  );

  const zeroRepsRes = await app.inject({
    method: 'POST',
    url: `/api/workout-exercises/${benchEntry?.id ?? 0}/sets`,
    payload: { weight: 60, reps: 0 },
  });
  check('次数为 0 -> 422', zeroRepsRes.statusCode === 422, zeroRepsRes.statusCode);

  const badDateRes = await app.inject({
    method: 'PUT',
    url: `/api/workouts/${workoutId ?? 0}`,
    payload: { date: '2026-02-30' },
  });
  check('不存在的日期（2026-02-30）-> 422', badDateRes.statusCode === 422, badDateRes.statusCode);

  const badSetIdRes = await app.inject({
    method: 'PUT',
    url: '/api/sets/999999',
    payload: { weight: 60 },
  });
  check('修改不存在的组 -> 404', badSetIdRes.statusCode === 404, badSetIdRes.statusCode);

  section('[18] 完成训练 / 上一次训练');
  const completeRes = await app.inject({
    method: 'POST',
    url: `/api/workouts/${workoutId ?? 0}/complete`,
  });
  const completed = completeRes.json<SuccessBody<WorkoutDto>>().data;

  check('完成训练 -> 200', completeRes.statusCode === 200, completeRes.statusCode);
  check('status = completed', completed?.status === 'completed', completed?.status);
  check('有结束时间', typeof completed?.endTime === 'string', completed?.endTime);
  check(
    '所有组被标记为已完成',
    (completed?.exercises ?? []).every((e) => e.sets.every((s) => s.completed)),
    (completed?.exercises ?? []).map((e) => e.sets.map((s) => s.completed)),
  );

  const completeAgainRes = await app.inject({
    method: 'POST',
    url: `/api/workouts/${workoutId ?? 0}/complete`,
  });
  check('重复完成 -> 409', completeAgainRes.statusCode === 409, completeAgainRes.statusCode);

  const activeAfterComplete = await app.inject({ method: 'GET', url: '/api/workouts/active' });
  check(
    '完成后不再有进行中的训练',
    activeAfterComplete.json<SuccessBody<WorkoutDto | null>>().data === null,
    activeAfterComplete.json(),
  );

  const lastWorkoutRes = await app.inject({
    method: 'GET',
    url: `/api/exercises/${benchPress?.id ?? 0}/last-workout`,
  });
  const lastWorkout = lastWorkoutRes.json<SuccessBody<LastWorkoutDto | null>>().data;

  check('查询上一次训练 -> 200', lastWorkoutRes.statusCode === 200, lastWorkoutRes.statusCode);
  check('返回的就是刚完成的这次训练', lastWorkout?.workoutId === workoutId, lastWorkout);
  check(
    '上次卧推数据是 80×10 / 80×8 / 75×10',
    JSON.stringify(lastWorkout?.sets.map((s) => [s.weight, s.reps])) ===
      JSON.stringify([
        [80, 10],
        [80, 8],
        [75, 10],
      ]),
    lastWorkout?.sets,
  );
  check('上次训练总量 = 2190', lastWorkout?.totalVolume === 2190, lastWorkout?.totalVolume);
  check(
    '上一次训练的数据带上了重量单位',
    (lastWorkout?.sets ?? []).every((set) => set.weightUnit === 'kg'),
    lastWorkout?.sets,
  );

  const lateralLastRes = await app.inject({
    method: 'GET',
    url: `/api/exercises/${lateralRaise?.id ?? 0}/last-workout`,
  });
  check(
    '侧平举也能查到这次的历史',
    lateralLastRes.json<SuccessBody<LastWorkoutDto | null>>().data?.workoutId === workoutId,
    lateralLastRes.json(),
  );

  // 用一个全新的自定义动作验证「没有历史时返回 null」，避免依赖库里已有的数据
  const freshExerciseRes = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    payload: { name: `无历史动作-${RUN_ID}`, muscleId: back?.id },
  });
  const freshExerciseId = freshExerciseRes.json<SuccessBody<ExerciseDto>>().data?.id;
  const noHistoryRes = await app.inject({
    method: 'GET',
    url: `/api/exercises/${freshExerciseId ?? 0}/last-workout`,
  });
  check(
    '从没练过的动作返回 null（不是报错）',
    noHistoryRes.statusCode === 200 &&
      noHistoryRes.json<SuccessBody<LastWorkoutDto | null>>().data === null,
    noHistoryRes.json(),
  );
  await app.inject({ method: 'DELETE', url: `/api/exercises/${freshExerciseId ?? 0}` });

  section('[19] 清理测试数据');
  const cleanupRes = await app.inject({
    method: 'DELETE',
    url: `/api/workouts/${workoutId ?? 0}`,
  });
  check('删除测试训练 -> 200', cleanupRes.statusCode === 200, cleanupRes.statusCode);

  const goneRes = await app.inject({ method: 'GET', url: `/api/workouts/${workoutId ?? 0}` });
  check('删除后该训练 -> 404', goneRes.statusCode === 404, goneRes.statusCode);

  section('[20] 统一错误处理');
  const notFoundRes = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
  check('未知路由 -> 404', notFoundRes.statusCode === 404, notFoundRes.statusCode);
  check(
    'error.code = ROUTE_NOT_FOUND',
    notFoundRes.json<ErrorBody>().error?.code === 'ROUTE_NOT_FOUND',
    notFoundRes.json(),
  );

  const badJsonRes = await app.inject({
    method: 'POST',
    url: '/api/exercises',
    headers: { 'content-type': 'application/json' },
    payload: '{ not-valid-json',
  });
  const badJsonBody = badJsonRes.json<ErrorBody>();
  check(
    '非法 JSON -> 4xx',
    badJsonRes.statusCode >= 400 && badJsonRes.statusCode < 500,
    badJsonRes.statusCode,
  );
  check(
    '不泄露内部错误信息',
    !/internal server error/i.test(badJsonBody.error?.message ?? ''),
    badJsonBody,
  );

  // ---------------------------------------------------------------- Phase 4
  section('[21] 补剂记录');

  const supplementsForTest = supplements.data ?? [];
  const creatine = supplementsForTest.find((s) => s.name === '肌酸');
  const protein = supplementsForTest.find((s) => s.name === '蛋白粉');
  const massGainer = supplementsForTest.find((s) => s.name === '增肌粉');
  const marker = `smoke-${RUN_ID}`;
  const today = localDateKey();

  // 先清掉本次可能残留的记录，保证可重复执行
  const existingRes = await app.inject({
    method: 'GET',
    url: `/api/supplement-records?date=${today}`,
  });
  const existing = existingRes.json<SuccessBody<SupplementRecordDto[]>>().data ?? [];
  for (const record of existing.filter((item) => item.note === marker)) {
    await app.inject({ method: 'DELETE', url: `/api/supplement-records/${record.id}` });
  }

  const plan: Array<[typeof creatine, number, string, string]> = [
    [creatine, 5, 'g', '训练后'],
    [protein, 30, 'g', '训练后'],
    [massGainer, 100, 'g', '早餐'],
  ];

  const createdIds: number[] = [];
  for (const [supplement, amount, unit, consumptionTime] of plan) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/supplement-records',
      payload: {
        supplementId: supplement?.id,
        amount,
        unit,
        consumptionTime,
        note: marker,
      },
    });
    const created = res.json<SuccessBody<SupplementRecordDto>>().data;
    if (created) createdIds.push(created.id);
    check(
      `记录 ${supplement?.name} ${amount}${unit} -> 201`,
      res.statusCode === 201,
      res.statusCode,
    );
  }

  const todayRes = await app.inject({
    method: 'GET',
    url: `/api/supplement-records?date=${today}`,
  });
  const todayRecords = (todayRes.json<SuccessBody<SupplementRecordDto[]>>().data ?? []).filter(
    (record) => record.note === marker,
  );

  check('按日期查询能取回这 3 条', todayRecords.length === 3, todayRecords.length);
  check(
    '肌酸 5g / 蛋白粉 30g / 增肌粉 100g',
    JSON.stringify(todayRecords.map((r) => `${r.supplement.name} ${r.amount}${r.unit}`).sort()) ===
      JSON.stringify(['肌酸 5g', '蛋白粉 30g', '增肌粉 100g'].sort()),
    todayRecords.map((r) => `${r.supplement.name} ${r.amount}${r.unit}`),
  );
  check(
    '每条都带上了补剂信息和时间标签',
    todayRecords.every((r) => r.supplement.name.length > 0 && r.consumptionTime !== null),
    todayRecords[0],
  );
  check(
    '不传 date 时默认记到今天',
    todayRecords.every((r) => r.date === today),
    todayRecords.map((r) => r.date),
  );

  const bySupplementRes = await app.inject({
    method: 'GET',
    url: `/api/supplement-records?supplementId=${creatine?.id ?? 0}`,
  });
  const bySupplement = bySupplementRes.json<SuccessBody<SupplementRecordDto[]>>().data ?? [];
  check(
    '按补剂过滤只返回肌酸的记录',
    bySupplement.length > 0 && bySupplement.every((r) => r.supplementId === creatine?.id),
    bySupplement.map((r) => r.supplement.name),
  );

  const recordToEdit = todayRecords.find((r) => r.supplement.name === '肌酸');
  const editRes = await app.inject({
    method: 'PUT',
    url: `/api/supplement-records/${recordToEdit?.id ?? 0}`,
    payload: { amount: 8, consumptionTime: '睡前' },
  });
  const edited = editRes.json<SuccessBody<SupplementRecordDto>>().data;
  check('修改用量和时间 -> 200', editRes.statusCode === 200, editRes.statusCode);
  check('用量已改成 8', edited?.amount === 8, edited?.amount);
  check('时间已改成睡前', edited?.consumptionTime === '睡前', edited?.consumptionTime);
  check('单位没被改掉', edited?.unit === 'g', edited?.unit);

  const negativeAmountRes = await app.inject({
    method: 'POST',
    url: '/api/supplement-records',
    payload: { supplementId: creatine?.id, amount: -5 },
  });
  check('用量为负 -> 422', negativeAmountRes.statusCode === 422, negativeAmountRes.statusCode);

  const badSupplementRes = await app.inject({
    method: 'POST',
    url: '/api/supplement-records',
    payload: { supplementId: 999_999, amount: 5 },
  });
  check('补剂不存在 -> 4xx', badSupplementRes.statusCode === 400, badSupplementRes.statusCode);

  const badRecordDateRes = await app.inject({
    method: 'GET',
    url: '/api/supplement-records?date=2026-13-45',
  });
  check('非法日期 -> 422', badRecordDateRes.statusCode === 422, badRecordDateRes.statusCode);

  const deleteRecordRes = await app.inject({
    method: 'DELETE',
    url: `/api/supplement-records/${recordToEdit?.id ?? 0}`,
  });
  check('删除记录 -> 200', deleteRecordRes.statusCode === 200, deleteRecordRes.statusCode);

  const afterDeleteRecordsRes = await app.inject({
    method: 'GET',
    url: `/api/supplement-records?date=${today}`,
  });
  check(
    '删除后列表里不再出现',
    !(afterDeleteRecordsRes.json<SuccessBody<SupplementRecordDto[]>>().data ?? []).some(
      (record) => record.id === recordToEdit?.id,
    ),
    afterDeleteRecordsRes.json(),
  );

  // 清场：把本次创建的记录都删掉
  for (const id of createdIds) {
    await app.inject({ method: 'DELETE', url: `/api/supplement-records/${id}` });
  }
  const finalRes = await app.inject({
    method: 'GET',
    url: `/api/supplement-records?date=${today}`,
  });
  check(
    '测试数据已清理干净',
    !(finalRes.json<SuccessBody<SupplementRecordDto[]>>().data ?? []).some(
      (record) => record.note === marker,
    ),
    null,
  );

  await app.close();
  await disconnectDatabase();

  console.log('');
  if (failures > 0) {
    console.error(`冒烟测试失败：${checks - failures}/${checks} 项通过，${failures} 项未通过。\n`);
    process.exitCode = 1;
  } else {
    console.log(`冒烟测试全部通过（${checks}/${checks}）。\n`);
  }
}

main().catch(async (error: unknown) => {
  console.error('冒烟测试执行异常：', error);
  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
