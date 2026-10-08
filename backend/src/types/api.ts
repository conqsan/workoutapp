/** 统一的成功响应包装。 */
export interface ApiSuccessBody<TData> {
  success: true;
  data: TData;
}

/** 统一的失败响应包装。 */
export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponseBody<TData> = ApiSuccessBody<TData> | ApiErrorBody;

/** 训练部位 */
export interface MuscleDto {
  id: number;
  name: string;
  sortOrder: number;
}

/** 训练动作（带上所属部位，前端不用再查一次） */
export interface ExerciseDto {
  id: number;
  name: string;
  muscleId: number;
  muscle: MuscleDto;
  description: string | null;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 补剂 */
export interface SupplementDto {
  id: number;
  name: string;
  /** 默认单位 */
  unit: string;
  /** 允许记录时使用的单位，第一项是默认值（例如蛋白粉 ['g', '勺']） */
  units: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 补剂使用记录 */
export interface SupplementRecordDto {
  id: number;
  supplementId: number;
  supplement: SupplementDto;
  /** 'YYYY-MM-DD' */
  date: string;
  amount: number;
  unit: string;
  /** '训练后' / '早餐' 这类场景标签 */
  consumptionTime: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 训练状态：SQLite 不支持 enum，用字符串 + 应用层校验 */
export type WorkoutStatus = 'active' | 'completed';

export interface WorkoutSetDto {
  id: number;
  workoutExerciseId: number;
  setNumber: number;
  weight: number;
  /** 录入时用的单位：'kg' | 'lb' */
  weightUnit: 'kg' | 'lb';
  reps: number;
  restSeconds: number | null;
  note: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExerciseDto {
  id: number;
  workoutId: number;
  exerciseId: number;
  /** 冗余带上动作与部位，前端渲染训练页时不用再查一次 */
  exercise: ExerciseDto;
  sortOrder: number;
  note: string | null;
  sets: WorkoutSetDto[];
}

export interface WorkoutDto {
  id: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  status: WorkoutStatus;
  exercises: WorkoutExerciseDto[];
  /** 训练总量 = Σ(weight × reps)，**统一换算成 kg** */
  totalVolume: number;
  totalSets: number;
}

/** GET /api/exercises/:id/last-workout —— 上一次该动作的训练数据 */
export interface LastWorkoutDto {
  workoutId: number;
  date: string;
  sets: Array<{ setNumber: number; weight: number; weightUnit: 'kg' | 'lb'; reps: number }>;
  totalVolume: number;
}

export interface HealthPayload {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    /** DATABASE_URL 是否已配置（Phase 1 起就应为 true）。 */
    configured: boolean;
    /** Prisma Client 是否已生成且能真正执行查询（Phase 2 定义模型并 db push 后变为 true）。 */
    initialized: boolean;
    /** initialized 为 false 时给出的可执行提示。 */
    message?: string;
  };
}
