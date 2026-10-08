/**
 * 备份 / 恢复的纯逻辑：校验、序列化、导入计划。
 *
 * 为什么单独放一层：
 *   1. IndexedDB 只能在浏览器里跑，这一层不碰任何浏览器 API，所以能在 Node 里
 *      直接单元测试（scripts/backup-test.ts，`npm run test:backup`）
 *   2. 「校验格式 → 校验结构 → 去重」的规则必须能脱离 UI 验证；
 *      导入失败时要给得出**精确到字段路径**的中文提示，而不是「导入失败」四个字
 *
 * 备份文件的结构：部位 / 动作 / 补剂 / 补剂记录是平铺数组，训练则嵌套
 * （workout → exercises → sets）—— 一次训练里的动作和组离开训练没有意义。
 */

import { toKilograms } from '../utils/weight';
import type {
  Exercise,
  Muscle,
  Supplement,
  SupplementRecord,
  WeightUnit,
  Workout,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutSet,
} from './types';

/** 备份文件的格式标记。导入前先认这个字段，避免把随便一个 JSON 当成备份。 */
export const BACKUP_FORMAT = 'fitlog-backup';
/** 备份结构版本。以后改结构时 +1，导入端据此判断还能不能读。 */
export const BACKUP_VERSION = 1;
/** 写进备份文件里的 App 版本（与 package.json 的 version 保持一致） */
export const APP_VERSION = '0.1.0';

/** 校验时最多列出多少条问题，避免一个坏文件刷屏 */
const MAX_ISSUES = 12;

export interface BackupWorkoutExercise extends WorkoutExercise {
  sets: WorkoutSet[];
}

export interface BackupWorkout extends Workout {
  exercises: BackupWorkoutExercise[];
}

export interface BackupData {
  muscles: Muscle[];
  exercises: Exercise[];
  supplements: Supplement[];
  supplementRecords: SupplementRecord[];
  workouts: BackupWorkout[];
}

export interface BackupSnapshot {
  format: string;
  version: number;
  appVersion: string;
  exportedAt: string;
  data: BackupData;
}

export interface BackupCounts {
  muscles: number;
  exercises: number;
  supplements: number;
  supplementRecords: number;
  workouts: number;
  workoutExercises: number;
  workoutSets: number;
}

export interface ValidationOk {
  ok: true;
  snapshot: BackupSnapshot;
}

export interface ValidationFailed {
  ok: false;
  errors: string[];
}

export type ValidationResult = ValidationOk | ValidationFailed;

export interface EntityCount {
  added: number;
  skipped: number;
}

export interface ImportResult {
  muscles: EntityCount;
  exercises: EntityCount;
  supplements: EntityCount;
  supplementRecords: EntityCount;
  workouts: EntityCount;
  workoutExercises: EntityCount;
  workoutSets: EntityCount;
  /** 新增的记录总数（不含跳过的） */
  addedTotal: number;
  /** 因为本机已经有而跳过的记录总数 */
  skippedTotal: number;
  /** 能导入但有话说的情况（例如引用的动作在本机不存在） */
  warnings: string[];
}

export interface ImportPlan {
  muscles: Muscle[];
  exercises: Exercise[];
  supplements: Supplement[];
  supplementRecords: SupplementRecord[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
  result: ImportResult;
}

// ------------------------------------------------------------------ 计数 / 摘要

export function countBackup(data: BackupData): BackupCounts {
  let workoutExercises = 0;
  let workoutSets = 0;

  for (const workout of data.workouts) {
    workoutExercises += workout.exercises.length;
    for (const exercise of workout.exercises) {
      workoutSets += exercise.sets.length;
    }
  }

  return {
    muscles: data.muscles.length,
    exercises: data.exercises.length,
    supplements: data.supplements.length,
    supplementRecords: data.supplementRecords.length,
    workouts: data.workouts.length,
    workoutExercises,
    workoutSets,
  };
}

/** 「10 个部位、46 个动作、3 次训练…」，0 的项不列出来 */
export function describeCounts(counts: BackupCounts): string {
  const parts: string[] = [];
  const push = (value: number, unit: string): void => {
    if (value > 0) parts.push(`${value} ${unit}`);
  };

  push(counts.muscles, '个部位');
  push(counts.exercises, '个动作');
  push(counts.supplements, '种补剂');
  push(counts.supplementRecords, '条补剂记录');
  push(counts.workouts, '次训练');
  push(counts.workoutSets, '组');

  return parts.length > 0 ? parts.join('、') : '暂无数据';
}

function describeBreakdown(counts: {
  muscles: EntityCount;
  exercises: EntityCount;
  supplements: EntityCount;
  supplementRecords: EntityCount;
  workouts: EntityCount;
}): string {
  const parts: string[] = [];
  const push = (label: string, value: number): void => {
    if (value > 0) parts.push(`${label} ${value}`);
  };

  push('部位', counts.muscles.added);
  push('动作', counts.exercises.added);
  push('补剂', counts.supplements.added);
  push('补剂记录', counts.supplementRecords.added);
  push('训练', counts.workouts.added);

  return parts.join('、');
}

/** 导入结果拆成给用户看的几行提示 */
export function describeImportResult(result: ImportResult): string[] {
  const added = describeBreakdown(result);

  return [
    added === '' ? '新增：无（本机已经有这些数据）' : `新增：${added}`,
    result.skippedTotal > 0 ? `跳过重复：${result.skippedTotal} 条` : '跳过重复：无',
  ];
}

// ------------------------------------------------------------------ JSON 序列化

export function toBackupJson(snapshot: BackupSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function parseBackupText(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      ok: false,
      errors: [`文件不是合法的 JSON：${error instanceof Error ? error.message : '无法解析'}`],
    };
  }

  return validateBackup(raw);
}

// ------------------------------------------------------------------ 校验

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 收集校验问题；超过上限之后只记数量，提示时一句带过 */
class IssueList {
  private readonly items: string[] = [];
  private overflow = 0;

  add(message: string): void {
    if (this.items.length < MAX_ISSUES) this.items.push(message);
    else this.overflow += 1;
  }

  get empty(): boolean {
    return this.items.length === 0 && this.overflow === 0;
  }

  list(): string[] {
    if (this.overflow === 0) return [...this.items];
    return [...this.items, `还有 ${this.overflow} 处问题没有列出，请检查文件是否被手工改过。`];
  }
}

function requireString(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): string | null {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    issues.add(`${path}.${key} 必须是非空字符串`);
    return null;
  }
  return value;
}

function optionalString(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): string | null {
  const value = source[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    issues.add(`${path}.${key} 必须是字符串`);
    return null;
  }
  return value;
}

function requireNumber(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): number | null {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.add(`${path}.${key} 必须是数字`);
    return null;
  }
  return value;
}

function requireNonNegative(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): number | null {
  const value = requireNumber(source, key, path, issues);
  if (value === null) return null;
  if (value < 0) {
    issues.add(`${path}.${key} 不能是负数`);
    return null;
  }
  return value;
}

function requireBoolean(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): boolean | null {
  const value = source[key];
  if (typeof value !== 'boolean') {
    issues.add(`${path}.${key} 必须是 true / false`);
    return null;
  }
  return value;
}

/** 'YYYY-MM-DD'，并且必须是真实存在的日期（2 月 30 日不算） */
function requireDate(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): string | null {
  const value = requireString(source, key, path, issues);
  if (value === null) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    issues.add(`${path}.${key} 必须是 YYYY-MM-DD 格式的日期`);
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00Z`);
  const valid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day);

  if (!valid) {
    issues.add(`${path}.${key} 的日期不存在（${value}）`);
    return null;
  }
  return value;
}

function requireArray(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): unknown[] | null {
  const value = source[key];
  if (!Array.isArray(value)) {
    issues.add(`${path}.${key} 必须是数组`);
    return null;
  }
  return value;
}

function requireWeightUnit(
  source: JsonObject,
  key: string,
  path: string,
  issues: IssueList,
): WeightUnit | null {
  const value = source[key];
  if (value !== 'kg' && value !== 'lb') {
    issues.add(`${path}.${key} 只能是 kg 或 lb`);
    return null;
  }
  return value;
}

function validateMuscle(raw: unknown, path: string, issues: IssueList): Muscle | null {
  if (!isObject(raw)) {
    issues.add(`${path} 应该是一个对象`);
    return null;
  }

  const id = requireString(raw, 'id', path, issues);
  const name = requireString(raw, 'name', path, issues);
  const sortOrder = requireNumber(raw, 'sortOrder', path, issues);
  if (id === null || name === null || sortOrder === null) return null;

  return { id, name, sortOrder };
}

function validateExercise(raw: unknown, path: string, issues: IssueList): Exercise | null {
  if (!isObject(raw)) {
    issues.add(`${path} 应该是一个对象`);
    return null;
  }

  const id = requireString(raw, 'id', path, issues);
  const name = requireString(raw, 'name', path, issues);
  const muscleId = requireString(raw, 'muscleId', path, issues);
  const isCustom = requireBoolean(raw, 'isCustom', path, issues);
  const sortOrder = requireNumber(raw, 'sortOrder', path, issues);

  const description = raw.description;
  if (description !== undefined && description !== null && typeof description !== 'string') {
    issues.add(`${path}.description 必须是字符串或 null`);
    return null;
  }

  if (
    id === null ||
    name === null ||
    muscleId === null ||
    isCustom === null ||
    sortOrder === null
  ) {
    return null;
  }

  return {
    id,
    name,
    muscleId,
    description: typeof description === 'string' ? description : null,
    isCustom,
    sortOrder,
  };
}

function validateSupplement(raw: unknown, path: string, issues: IssueList): Supplement | null {
  if (!isObject(raw)) {
    issues.add(`${path} 应该是一个对象`);
    return null;
  }

  const id = requireString(raw, 'id', path, issues);
  const name = requireString(raw, 'name', path, issues);
  const unit = requireString(raw, 'unit', path, issues);
  const isDefault = requireBoolean(raw, 'isDefault', path, issues);
  const sortOrder = requireNumber(raw, 'sortOrder', path, issues);
  if (id === null || name === null || unit === null || isDefault === null || sortOrder === null) {
    return null;
  }

  return { id, name, unit, isDefault, sortOrder };
}

function validateSupplementRecord(
  raw: unknown,
  path: string,
  issues: IssueList,
): SupplementRecord | null {
  if (!isObject(raw)) {
    issues.add(`${path} 应该是一个对象`);
    return null;
  }

  const id = requireString(raw, 'id', path, issues);
  const supplementId = requireString(raw, 'supplementId', path, issues);
  const date = requireDate(raw, 'date', path, issues);
  const amount = requireNonNegative(raw, 'amount', path, issues);
  const unit = requireString(raw, 'unit', path, issues);
  const consumptionTime = optionalString(raw, 'consumptionTime', path, issues);
  const note = optionalString(raw, 'note', path, issues);
  const createdAt = optionalString(raw, 'createdAt', path, issues);

  if (
    id === null ||
    supplementId === null ||
    date === null ||
    amount === null ||
    unit === null ||
    consumptionTime === null ||
    note === null ||
    createdAt === null
  ) {
    return null;
  }

  return {
    id,
    supplementId,
    date,
    amount,
    unit,
    consumptionTime,
    note,
    createdAt: createdAt === '' ? new Date().toISOString() : createdAt,
  };
}

function validateWorkoutSet(raw: unknown, path: string, issues: IssueList): WorkoutSet | null {
  if (!isObject(raw)) {
    issues.add(`${path} 应该是一个对象`);
    return null;
  }

  const id = requireString(raw, 'id', path, issues);
  const workoutExerciseId = requireString(raw, 'workoutExerciseId', path, issues);
  const setNumber = requireNumber(raw, 'setNumber', path, issues);
  const weight = requireNonNegative(raw, 'weight', path, issues);
  const weightUnit = requireWeightUnit(raw, 'weightUnit', path, issues);
  const reps = requireNonNegative(raw, 'reps', path, issues);
  const completed = requireBoolean(raw, 'completed', path, issues);
  const note = optionalString(raw, 'note', path, issues);
  const createdAt = optionalString(raw, 'createdAt', path, issues);

  const restSeconds = raw.restSeconds;
  if (restSeconds !== undefined && restSeconds !== null) {
    if (typeof restSeconds !== 'number' || !Number.isFinite(restSeconds) || restSeconds < 0) {
      issues.add(`${path}.restSeconds 必须是非负数字或 null`);
      return null;
    }
  }

  if (
    id === null ||
    workoutExerciseId === null ||
    setNumber === null ||
    weight === null ||
    weightUnit === null ||
    reps === null ||
    completed === null ||
    note === null ||
    createdAt === null
  ) {
    return null;
  }

  return {
    id,
    workoutExerciseId,
    setNumber,
    weight,
    weightUnit,
    reps,
    restSeconds: typeof restSeconds === 'number' ? restSeconds : null,
    note,
    completed,
    createdAt: createdAt === '' ? new Date().toISOString() : createdAt,
  };
}

function validateWorkoutExercise(
  raw: unknown,
  path: string,
  issues: IssueList,
): BackupWorkoutExercise | null {
  if (!isObject(raw)) {
    issues.add(`${path} 应该是一个对象`);
    return null;
  }

  const id = requireString(raw, 'id', path, issues);
  const workoutId = requireString(raw, 'workoutId', path, issues);
  const exerciseId = requireString(raw, 'exerciseId', path, issues);
  const exerciseName = requireString(raw, 'exerciseName', path, issues);
  const muscleId = optionalString(raw, 'muscleId', path, issues);
  const muscleName = optionalString(raw, 'muscleName', path, issues);
  const sortOrder = requireNumber(raw, 'sortOrder', path, issues);
  const note = optionalString(raw, 'note', path, issues);
  const createdAt = optionalString(raw, 'createdAt', path, issues);
  const rawSets = requireArray(raw, 'sets', path, issues);

  if (
    id === null ||
    workoutId === null ||
    exerciseId === null ||
    exerciseName === null ||
    muscleId === null ||
    muscleName === null ||
    sortOrder === null ||
    note === null ||
    createdAt === null ||
    rawSets === null
  ) {
    return null;
  }

  const sets: WorkoutSet[] = [];
  rawSets.forEach((item, index) => {
    const set = validateWorkoutSet(item, `${path}.sets[${index}]`, issues);
    if (set) sets.push(set);
  });

  return {
    id,
    workoutId,
    exerciseId,
    exerciseName,
    muscleId,
    muscleName,
    sortOrder,
    note,
    createdAt: createdAt === '' ? new Date().toISOString() : createdAt,
    sets,
  };
}

function validateWorkout(raw: unknown, path: string, issues: IssueList): BackupWorkout | null {
  if (!isObject(raw)) {
    issues.add(`${path} 应该是一个对象`);
    return null;
  }

  const id = requireString(raw, 'id', path, issues);
  const date = requireDate(raw, 'date', path, issues);
  const startTime = requireString(raw, 'startTime', path, issues);
  const note = optionalString(raw, 'note', path, issues);
  const createdAt = optionalString(raw, 'createdAt', path, issues);
  const updatedAt = optionalString(raw, 'updatedAt', path, issues);
  const status = raw.status;
  if (status !== 'active' && status !== 'completed') {
    issues.add(`${path}.status 只能是 active 或 completed`);
    return null;
  }

  const endTime = raw.endTime;
  if (endTime !== undefined && endTime !== null && typeof endTime !== 'string') {
    issues.add(`${path}.endTime 必须是字符串或 null`);
    return null;
  }

  const rawExercises = requireArray(raw, 'exercises', path, issues);
  if (
    id === null ||
    date === null ||
    startTime === null ||
    note === null ||
    createdAt === null ||
    updatedAt === null ||
    rawExercises === null
  ) {
    return null;
  }

  const exercises: BackupWorkoutExercise[] = [];
  rawExercises.forEach((item, index) => {
    const exercise = validateWorkoutExercise(item, `${path}.exercises[${index}]`, issues);
    if (exercise) exercises.push(exercise);
  });

  const createdAtValue = createdAt === '' ? new Date().toISOString() : createdAt;

  return {
    id,
    date,
    startTime,
    endTime: typeof endTime === 'string' ? endTime : null,
    note,
    status,
    createdAt: createdAtValue,
    updatedAt: updatedAt === '' ? createdAtValue : updatedAt,
    exercises,
  };
}

export function validateBackup(raw: unknown): ValidationResult {
  const issues = new IssueList();

  if (!isObject(raw)) {
    return { ok: false, errors: ['备份文件的最外层必须是一个 JSON 对象'] };
  }

  if (raw.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      errors: [
        `这不是 FitLog 的备份文件（format 应该是 "${BACKUP_FORMAT}"，实际是 ${JSON.stringify(raw.format)}）`,
      ],
    };
  }

  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, errors: ['备份文件缺少合法的 version 字段（应该是正整数）'] };
  }
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      errors: [
        `备份文件的版本是 ${version}，比当前 App 支持的 ${BACKUP_VERSION} 更新，请先更新 App 再导入。`,
      ],
    };
  }

  const data = raw.data;
  if (!isObject(data)) {
    return { ok: false, errors: ['备份文件缺少 data 字段（应该是对象）'] };
  }

  const rawMuscles = requireArray(data, 'muscles', 'data', issues);
  const rawExercises = requireArray(data, 'exercises', 'data', issues);
  const rawSupplements = requireArray(data, 'supplements', 'data', issues);
  const rawRecords = requireArray(data, 'supplementRecords', 'data', issues);
  const rawWorkouts = requireArray(data, 'workouts', 'data', issues);

  const muscles: Muscle[] = [];
  const exercises: Exercise[] = [];
  const supplements: Supplement[] = [];
  const supplementRecords: SupplementRecord[] = [];
  const workouts: BackupWorkout[] = [];

  rawMuscles?.forEach((item, index) => {
    const muscle = validateMuscle(item, `data.muscles[${index}]`, issues);
    if (muscle) muscles.push(muscle);
  });
  rawExercises?.forEach((item, index) => {
    const exercise = validateExercise(item, `data.exercises[${index}]`, issues);
    if (exercise) exercises.push(exercise);
  });
  rawSupplements?.forEach((item, index) => {
    const supplement = validateSupplement(item, `data.supplements[${index}]`, issues);
    if (supplement) supplements.push(supplement);
  });
  rawRecords?.forEach((item, index) => {
    const record = validateSupplementRecord(item, `data.supplementRecords[${index}]`, issues);
    if (record) supplementRecords.push(record);
  });
  rawWorkouts?.forEach((item, index) => {
    const workout = validateWorkout(item, `data.workouts[${index}]`, issues);
    if (workout) workouts.push(workout);
  });

  if (!issues.empty) {
    return { ok: false, errors: issues.list() };
  }

  return {
    ok: true,
    snapshot: {
      format: BACKUP_FORMAT,
      version,
      appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : '未知',
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      data: { muscles, exercises, supplements, supplementRecords, workouts },
    },
  };
}

// ------------------------------------------------------------------ CSV 导出

export const CSV_HEADERS = [
  '训练日期',
  '开始时间',
  '状态',
  '部位',
  '动作',
  '组号',
  '重量',
  '单位',
  '次数',
  '休息(秒)',
  '本组训练量(kg)',
  '组备注',
  '动作备注',
  '训练备注',
] as const;

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 训练组明细导出成 CSV：一行 = 一组。
 *
 * 用 CRLF 换行 + 前置 BOM：Excel 打开中文列名和中文备注才不会乱码。
 * 所有重量都额外给一列换算后的 kg，方便直接在表格里透视。
 */
export function serializeWorkoutSetsCsv(workouts: readonly WorkoutDetail[]): string {
  const lines: string[] = [CSV_HEADERS.join(',')];

  const sorted = [...workouts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );

  for (const workout of sorted) {
    for (const entry of workout.exercises) {
      for (const set of entry.sets) {
        const volumeKg = round2(toKilograms(set.weight, set.weightUnit) * set.reps);
        lines.push(
          [
            workout.date,
            workout.startTime,
            workout.status === 'completed' ? '已完成' : '进行中',
            entry.muscleName,
            entry.exerciseName,
            String(set.setNumber),
            String(set.weight),
            set.weightUnit,
            String(set.reps),
            set.restSeconds === null ? '' : String(set.restSeconds),
            String(volumeKg),
            set.note,
            entry.note,
            workout.note,
          ]
            .map(csvCell)
            .join(','),
        );
      }
    }
  }

  return `\ufeff${lines.join('\r\n')}\r\n`;
}

// ------------------------------------------------------------------ 导入计划

function exerciseKey(muscleId: string, name: string): string {
  return `${muscleId}\u0000${name}`;
}

function recordKey(record: SupplementRecord): string {
  return [
    record.supplementId,
    record.date,
    record.amount,
    record.unit,
    record.consumptionTime,
  ].join('\u0000');
}

function workoutKey(workout: Workout): string {
  return `${workout.date}\u0000${workout.startTime}`;
}

function countOf(added: number, skipped: number): EntityCount {
  return { added, skipped };
}

/**
 * 算出「要往本机写哪些行」，不碰数据库。
 *
 * 去重规则（两条都很关键）：
 *   1. **先按 id**：id 已经在本机 → 跳过，说明这条数据本来就在这里
 *   2. **再按业务键**：部位 / 动作 / 补剂按名字，训练按「日期 + 开始时间」，
 *      补剂记录按「补剂 + 日期 + 用量 + 单位 + 时间」。
 *      同一个部位在另一台设备上会有另一个 id，按名字合并才不会出现两个「胸」。
 *
 * 合并时被跳过的实体，引用它的地方（动作 → 部位、训练动作 → 动作、
 * 补剂记录 → 补剂）都要改指向本机已有的那条，否则会指向一个不存在的 id。
 */
export function planImport(existing: BackupData, incoming: BackupData): ImportPlan {
  const warnings: string[] = [];

  // ---- 部位：id → 名字
  const muscleIds = new Set(existing.muscles.map((muscle) => muscle.id));
  const muscleIdByName = new Map(existing.muscles.map((muscle) => [muscle.name, muscle.id]));
  const muscleAlias = new Map<string, string>();
  const newMuscles: Muscle[] = [];
  let musclesSkipped = 0;

  for (const muscle of incoming.muscles) {
    if (muscleIds.has(muscle.id)) {
      musclesSkipped += 1;
      continue;
    }
    const sameName = muscleIdByName.get(muscle.name);
    if (sameName !== undefined) {
      muscleAlias.set(muscle.id, sameName);
      musclesSkipped += 1;
      continue;
    }

    muscleIds.add(muscle.id);
    muscleIdByName.set(muscle.name, muscle.id);
    newMuscles.push(muscle);
  }

  const resolveMuscle = (id: string): string => muscleAlias.get(id) ?? id;

  // ---- 动作：id → (部位 + 名字)
  const exerciseIds = new Set(existing.exercises.map((exercise) => exercise.id));
  const exerciseIdByKey = new Map(
    existing.exercises.map((exercise) => [
      exerciseKey(exercise.muscleId, exercise.name),
      exercise.id,
    ]),
  );
  const exerciseAlias = new Map<string, string>();
  const newExercises: Exercise[] = [];
  let exercisesSkipped = 0;
  let exercisesWithMissingMuscle = 0;

  for (const exercise of incoming.exercises) {
    const muscleId = resolveMuscle(exercise.muscleId);
    if (!muscleIds.has(muscleId)) {
      // 部位在本机既不存在、备份里也没带来：动作仍然收下（名字还在），只是归不了类
      exercisesWithMissingMuscle += 1;
    }

    if (exerciseIds.has(exercise.id)) {
      exercisesSkipped += 1;
      continue;
    }

    const key = exerciseKey(muscleId, exercise.name);
    const sameName = exerciseIdByKey.get(key);
    if (sameName !== undefined) {
      exerciseAlias.set(exercise.id, sameName);
      exercisesSkipped += 1;
      continue;
    }

    exerciseIds.add(exercise.id);
    exerciseIdByKey.set(key, exercise.id);
    newExercises.push({ ...exercise, muscleId });
  }

  // ---- 补剂：id → 名字
  const supplementIds = new Set(existing.supplements.map((supplement) => supplement.id));
  const supplementIdByName = new Map(
    existing.supplements.map((supplement) => [supplement.name, supplement.id]),
  );
  const supplementAlias = new Map<string, string>();
  const newSupplements: Supplement[] = [];
  let supplementsSkipped = 0;

  for (const supplement of incoming.supplements) {
    if (supplementIds.has(supplement.id)) {
      supplementsSkipped += 1;
      continue;
    }
    const sameName = supplementIdByName.get(supplement.name);
    if (sameName !== undefined) {
      supplementAlias.set(supplement.id, sameName);
      supplementsSkipped += 1;
      continue;
    }

    supplementIds.add(supplement.id);
    supplementIdByName.set(supplement.name, supplement.id);
    newSupplements.push(supplement);
  }

  const resolveSupplement = (id: string): string => supplementAlias.get(id) ?? id;

  // ---- 补剂记录
  const recordIds = new Set(existing.supplementRecords.map((record) => record.id));
  const recordKeys = new Set(existing.supplementRecords.map(recordKey));
  const newRecords: SupplementRecord[] = [];
  let recordsSkipped = 0;
  let recordsWithMissingSupplement = 0;

  for (const record of incoming.supplementRecords) {
    const supplementId = resolveSupplement(record.supplementId);
    if (!supplementIds.has(supplementId)) {
      recordsWithMissingSupplement += 1;
    }

    const next: SupplementRecord = { ...record, supplementId };
    if (recordIds.has(next.id) || recordKeys.has(recordKey(next))) {
      recordsSkipped += 1;
      continue;
    }

    recordIds.add(next.id);
    recordKeys.add(recordKey(next));
    newRecords.push(next);
  }

  // ---- 训练（连同动作与组）
  const workoutIds = new Set(existing.workouts.map((workout) => workout.id));
  const workoutKeys = new Set(existing.workouts.map(workoutKey));
  const newWorkouts: Workout[] = [];
  const newWorkoutExercises: WorkoutExercise[] = [];
  const newWorkoutSets: WorkoutSet[] = [];
  let workoutsSkipped = 0;
  let entriesSkipped = 0;
  let setsSkipped = 0;
  let entriesWithMissingExercise = 0;
  let activeWorkouts = 0;

  for (const workout of incoming.workouts) {
    if (workoutIds.has(workout.id) || workoutKeys.has(workoutKey(workout))) {
      workoutsSkipped += 1;
      // 整次训练被跳过时，它下面的动作与组也算「跳过的重复」——
      // 否则「跳过 7 条」和「新增 10 条」对不上，用户会以为漏了什么
      entriesSkipped += workout.exercises.length;
      for (const entry of workout.exercises) {
        setsSkipped += entry.sets.length;
      }
      continue;
    }

    workoutIds.add(workout.id);
    workoutKeys.add(workoutKey(workout));

    if (workout.status === 'active') activeWorkouts += 1;

    const { exercises: entries, ...rest } = workout;
    newWorkouts.push(rest);

    for (const entry of entries) {
      const exerciseId = exerciseAlias.get(entry.exerciseId) ?? entry.exerciseId;
      if (!exerciseIds.has(exerciseId)) entriesWithMissingExercise += 1;

      const { sets, ...entryRest } = entry;
      newWorkoutExercises.push({
        ...entryRest,
        workoutId: workout.id,
        exerciseId,
        muscleId: resolveMuscle(entry.muscleId),
      });

      for (const set of sets) {
        newWorkoutSets.push({ ...set, workoutExerciseId: entry.id });
      }
    }
  }

  // 同一份备份里自带的重复 id：只留第一条，避免 put 覆盖顺序不同导致数据打架
  const uniqueEntries = dedupeById(
    newWorkoutExercises,
    (entry) => entry.id,
    () => {
      entriesSkipped += 1;
    },
  );
  const uniqueSets = dedupeById(
    newWorkoutSets,
    (set) => set.id,
    () => {
      setsSkipped += 1;
    },
  );
  const entryIds = new Set(uniqueEntries.map((entry) => entry.id));
  const keptSets = uniqueSets.filter((set) => {
    const keep = entryIds.has(set.workoutExerciseId);
    if (!keep) setsSkipped += 1;
    return keep;
  });

  if (exercisesWithMissingMuscle > 0) {
    warnings.push(
      `${exercisesWithMissingMuscle} 个动作引用的部位在本机不存在，导入后不会出现在任何部位下。`,
    );
  }
  if (recordsWithMissingSupplement > 0) {
    warnings.push(
      `${recordsWithMissingSupplement} 条补剂记录引用的补剂在本机不存在，记录仍在，名称显示为「已删除的补剂」。`,
    );
  }
  if (entriesWithMissingExercise > 0) {
    warnings.push(
      `${entriesWithMissingExercise} 个训练动作引用的动作在本机不存在，历史里保留当时的动作名。`,
    );
  }
  if (activeWorkouts > 0) {
    warnings.push(
      `导入的数据里有 ${activeWorkouts} 次「进行中」的训练，训练页只显示最近开始的那一次。`,
    );
  }

  const muscles = countOf(newMuscles.length, musclesSkipped);
  const exercises = countOf(newExercises.length, exercisesSkipped);
  const supplements = countOf(newSupplements.length, supplementsSkipped);
  const supplementRecords = countOf(newRecords.length, recordsSkipped);
  const workouts = countOf(newWorkouts.length, workoutsSkipped);
  const workoutExercises = countOf(uniqueEntries.length, entriesSkipped);
  const workoutSets = countOf(keptSets.length, setsSkipped);

  const all = [
    muscles,
    exercises,
    supplements,
    supplementRecords,
    workouts,
    workoutExercises,
    workoutSets,
  ];

  return {
    muscles: newMuscles,
    exercises: newExercises,
    supplements: newSupplements,
    supplementRecords: newRecords,
    workouts: newWorkouts,
    workoutExercises: uniqueEntries,
    workoutSets: keptSets,
    result: {
      muscles,
      exercises,
      supplements,
      supplementRecords,
      workouts,
      workoutExercises,
      workoutSets,
      addedTotal: all.reduce((total, item) => total + item.added, 0),
      skippedTotal: all.reduce((total, item) => total + item.skipped, 0),
      warnings,
    },
  };
}

function dedupeById<T>(rows: readonly T[], idOf: (row: T) => string, onDuplicate: () => void): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];

  for (const row of rows) {
    const id = idOf(row);
    if (seen.has(id)) {
      onDuplicate();
      continue;
    }
    seen.add(id);
    kept.push(row);
  }

  return kept;
}
