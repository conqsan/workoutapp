/**
 * 前端自己的领域模型。
 *
 * 和 src/types/api.ts 里的 *Dto 区分开：Dto 是后端接口的传输格式（数字 id），
 * 这里是本地数据库里的形状（字符串 id、冗余保存动作名与部位名）。
 * Phase 8 做同步时会在两者之间加一层映射，UI 不用改。
 */

import type { WeightUnit } from '@/utils/weight';
import type { BackupSnapshot, ImportResult } from './backup';

export type { WeightUnit };

export type WorkoutStatus = 'active' | 'completed';

export interface Muscle {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleId: string;
  description: string | null;
  isCustom: boolean;
  /**
   * 仅本地使用：决定动作在列表里的先后。
   * 默认动作用 seed 里的书写顺序（卧推 → 上斜 → 下斜…），自定义动作排在最后。
   */
  sortOrder: number;
}

export interface Workout {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** ISO 时间 */
  startTime: string;
  endTime: string | null;
  note: string;
  status: WorkoutStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  /** 冗余快照：即使动作被改名或删掉，历史记录仍然读得出来 */
  exerciseName: string;
  muscleId: string;
  muscleName: string;
  sortOrder: number;
  note: string;
  createdAt: string;
}

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  setNumber: number;
  weight: number;
  /** 这一组是按哪个单位录入的。v2 之前的老数据没有这个字段，读的时候按 kg 兜底。 */
  weightUnit: WeightUnit;
  reps: number;
  restSeconds: number | null;
  note: string;
  completed: boolean;
  createdAt: string;
}

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  sets: WorkoutSet[];
}

export interface WorkoutDetail extends Workout {
  exercises: WorkoutExerciseWithSets[];
  /** Σ(weight × reps)，**统一换算成 kg**（混着 kg/lb 相加是没有意义的） */
  totalVolume: number;
  totalSets: number;
}

/** 历史列表用的轻量摘要（不带每一组的明细） */
export interface WorkoutSummary {
  id: string;
  date: string;
  status: WorkoutStatus;
  startTime: string;
  endTime: string | null;
  /** 这次训练练到的部位，去重后按加入顺序 */
  muscleNames: string[];
  exerciseCount: number;
  setCount: number;
  /** 统一换算成 kg */
  totalVolume: number;
  note: string;
}

export interface LastWorkoutSummary {
  date: string;
  sets: Array<{ setNumber: number; weight: number; weightUnit: WeightUnit; reps: number }>;
  totalVolume: number;
}

export interface StartWorkoutInput {
  date?: string;
  note?: string;
}

export interface AddWorkoutExerciseInput {
  exerciseId: string;
}

export interface WorkoutSetInput {
  weight: number;
  weightUnit?: WeightUnit;
  reps: number;
  restSeconds?: number | null;
  note?: string;
  completed?: boolean;
}

export type WorkoutSetPatch = Partial<WorkoutSetInput>;

/** 修改一次训练（历史记录里的「修改」用） */
export interface UpdateWorkoutInput {
  /** 'YYYY-MM-DD'；不传就保持原样 */
  date?: string;
  /** 不传就保持原样 */
  note?: string;
}

export interface CreateExerciseInput {
  name: string;
  muscleId: string;
  description?: string | null;
}

export interface Supplement {
  id: string;
  name: string;
  /** 默认单位（没有特别说明时用它） */
  unit: string;
  /**
   * 允许记录时使用的单位，第一项是默认值，例如蛋白粉 ['g', '勺']。
   * 老数据（v4 之前）没有这个字段，读的时候按 [unit] 兜底。
   */
  units: string[];
  isDefault: boolean;
  /** 仅本地使用：默认补剂按 seed 顺序排在前面 */
  sortOrder: number;
}

export interface SupplementRecord {
  id: string;
  supplementId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  amount: number;
  unit: string;
  /** '训练后' / '早餐' 这类场景标签，不是时刻 */
  consumptionTime: string;
  note: string;
  createdAt: string;
}

/** 展示用：把补剂名称冗余进来，避免每次都去查一次补剂表 */
export interface SupplementRecordWithSupplement extends SupplementRecord {
  supplementName: string;
  /** 所属补剂允许的单位（记录行里可以直接点选） */
  units: string[];
  isDefault: boolean;
}

export interface CreateSupplementInput {
  name: string;
  unit?: string;
  /** 不传就按 [unit] 处理 */
  units?: string[];
}

export interface SupplementRecordInput {
  supplementId: string;
  date?: string;
  amount: number;
  unit?: string;
  consumptionTime?: string;
  note?: string;
}

export type SupplementRecordPatch = Partial<SupplementRecordInput>;

/**
 * 数据层接口。
 *
 * Phase 3 只提供 IndexedDB 实现（手机本地优先，不需要电脑开机）。
 * Phase 8 做同步时再补 HTTP 实现，UI 只依赖这个接口，不用改。
 */
export interface FitLogRepository {
  // 基础数据
  listMuscles(): Promise<Muscle[]>;
  listExercises(muscleId?: string): Promise<Exercise[]>;
  createExercise(input: CreateExerciseInput): Promise<Exercise>;

  // 补剂
  listSupplements(): Promise<Supplement[]>;
  createSupplement(input: CreateSupplementInput): Promise<Supplement>;
  listSupplementRecords(filter?: {
    date?: string;
    supplementId?: string;
  }): Promise<SupplementRecordWithSupplement[]>;
  addSupplementRecord(input: SupplementRecordInput): Promise<SupplementRecordWithSupplement>;
  updateSupplementRecord(
    id: string,
    patch: SupplementRecordPatch,
  ): Promise<SupplementRecordWithSupplement>;
  removeSupplementRecord(id: string): Promise<void>;

  // 训练
  getActiveWorkout(): Promise<WorkoutDetail | null>;
  /** 所有训练的完整明细（统计页用；内部只查三次库） */
  listWorkouts(): Promise<WorkoutDetail[]>;
  /** 历史列表：所有训练（含进行中）的摘要，按日期倒序 */
  listWorkoutSummaries(): Promise<WorkoutSummary[]>;
  startWorkout(input?: StartWorkoutInput): Promise<WorkoutDetail>;
  getWorkout(id: string): Promise<WorkoutDetail | null>;
  updateWorkoutNote(id: string, note: string): Promise<WorkoutDetail>;
  /** 改训练的日期 / 备注（历史记录详情页用） */
  updateWorkout(id: string, patch: UpdateWorkoutInput): Promise<WorkoutDetail>;
  deleteWorkout(id: string): Promise<void>;
  completeWorkout(id: string): Promise<WorkoutDetail>;

  // 训练里的动作
  addWorkoutExercise(workoutId: string, input: AddWorkoutExerciseInput): Promise<WorkoutDetail>;
  removeWorkoutExercise(id: string): Promise<WorkoutDetail>;
  moveWorkoutExercise(id: string, direction: 'up' | 'down'): Promise<WorkoutDetail>;
  setWorkoutExerciseNote(id: string, note: string): Promise<WorkoutDetail>;

  // 训练组
  addSet(workoutExerciseId: string, input: WorkoutSetInput): Promise<WorkoutDetail>;
  copyLastSet(workoutExerciseId: string): Promise<WorkoutDetail>;
  updateSet(id: string, patch: WorkoutSetPatch): Promise<WorkoutDetail>;
  removeSet(id: string): Promise<WorkoutDetail>;
  copyLastWorkout(workoutExerciseId: string): Promise<WorkoutDetail>;

  // 上一次训练
  getLastWorkout(exerciseId: string): Promise<LastWorkoutSummary | null>;

  // 备份与恢复（Phase 9）
  /** 把本机全部数据打包成一份备份快照（导出 JSON 的内容） */
  exportBackup(): Promise<BackupSnapshot>;
  /** 把一份已经校验过的备份合并进本机（按 id 与业务键去重），返回新增 / 跳过的明细 */
  importBackup(snapshot: BackupSnapshot): Promise<ImportResult>;
}
