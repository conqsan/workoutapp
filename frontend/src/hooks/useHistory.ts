import { useCallback, useEffect, useRef, useState } from 'react';
import { initDataLayer, repository } from '@/data';
import type {
  CreateExerciseInput,
  Exercise,
  Muscle,
  SupplementRecordWithSupplement,
  UpdateWorkoutInput,
  WorkoutDetail,
  WorkoutSetPatch,
  WorkoutSummary,
} from '@/data';

/**
 * 历史列表按「天」合并后的条目。
 * 一天练几次都只占一行，展开详情里再按场次分开看。
 */
export interface HistoryDay {
  date: string;
  /** 当天的训练（含进行中），按开始时间升序 */
  sessions: WorkoutSummary[];
  /** 点进详情用哪一条 —— 用当天最近的一次 */
  primaryWorkoutId: string;
  sessionCount: number;
  totalVolume: number;
  setCount: number;
  exerciseCount: number;
  muscleNames: string[];
  note: string;
  hasActive: boolean;
}

export interface UseHistoryResult {
  loading: boolean;
  days: HistoryDay[];
  error: string | null;
  removing: boolean;
  /** 删掉一整天的记录（当天的每一次训练都会删） */
  removeDay: (date: string) => Promise<void>;
}

/** 把逐次的摘要按日期合并成「一天一行」 */
export function groupSummariesByDay(summaries: readonly WorkoutSummary[]): HistoryDay[] {
  const byDate = new Map<string, HistoryDay>();

  for (const summary of summaries) {
    const day = byDate.get(summary.date) ?? {
      date: summary.date,
      sessions: [],
      primaryWorkoutId: summary.id,
      sessionCount: 0,
      totalVolume: 0,
      setCount: 0,
      exerciseCount: 0,
      muscleNames: [],
      note: '',
      hasActive: false,
    };

    day.sessions.push(summary);
    day.sessionCount += 1;
    day.totalVolume += summary.totalVolume;
    day.setCount += summary.setCount;
    day.exerciseCount += summary.exerciseCount;
    for (const name of summary.muscleNames) {
      if (!day.muscleNames.includes(name)) day.muscleNames.push(name);
    }
    if (day.note === '' && summary.note !== '') day.note = summary.note;
    if (summary.status === 'active') day.hasActive = true;

    byDate.set(summary.date, day);
  }

  return [...byDate.values()];
}

/** 历史列表：所有训练按天合并，日期倒序 */
export function useHistory(): UseHistoryResult {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initDataLayer();
        const list = await repository.listWorkoutSummaries();
        if (!cancelled) setDays(groupSummariesByDay(list));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '读取历史记录失败。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const removeDay = useCallback(async (date: string): Promise<void> => {
    setRemoving(true);
    setError(null);
    try {
      const list = await repository.listWorkoutSummaries();
      for (const summary of list) {
        if (summary.date !== date) continue;
        await repository.deleteWorkout(summary.id);
      }
      const next = await repository.listWorkoutSummaries();
      setDays(groupSummariesByDay(next));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败，请重试。');
    } finally {
      setRemoving(false);
    }
  }, []);

  return { loading, days, error, removing, removeDay };
}

export interface UseHistoryDetailResult {
  loading: boolean;
  /** URL 指向的那一次训练 */
  workout: WorkoutDetail | null;
  /** 同一天的全部训练，按开始时间升序 —— 详情页按「第 N 次」分开显示 */
  sessions: WorkoutDetail[];
  supplements: SupplementRecordWithSupplement[];
  /** 动作 id → 一组几个重量框（递减组是 3），编辑某组时用 */
  slotsByExerciseId: Record<string, number>;
  /** 给「添加动作」用的动作库 */
  muscles: Muscle[];
  exercises: Exercise[];
  error: string | null;
  removing: boolean;
  saving: boolean;
  /** 改某一次训练的日期 / 备注 */
  update: (workoutId: string, patch: UpdateWorkoutInput) => Promise<void>;
  /** 改某一组（重量 / 次数 / 休息） */
  updateSet: (setId: string, patch: WorkoutSetPatch) => Promise<void>;
  /** 删掉某一组（剩下的组号会自动压成 1..n） */
  removeSet: (setId: string) => Promise<void>;
  /** 往某一次训练里加动作 */
  addExercise: (workoutId: string, exerciseId: string) => Promise<void>;
  /** 新建自定义动作并直接加进这次训练 */
  createExercise: (workoutId: string, input: CreateExerciseInput) => Promise<void>;
  /** 给某个动作加一组：沿用它的上一组，没有就 20kg×10 */
  addSet: (workoutExerciseId: string) => Promise<void>;
  /** 删掉某一次训练 */
  removeWorkout: (workoutId: string) => Promise<void>;
}

/** 某一天的完整明细（含当天每一次训练）+ 同一天的补剂记录 */
export function useHistoryDetail(id: string | undefined): UseHistoryDetailResult {
  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [sessions, setSessions] = useState<WorkoutDetail[]>([]);
  const [supplements, setSupplements] = useState<SupplementRecordWithSupplement[]>([]);
  const [slotsByExerciseId, setSlotsByExerciseId] = useState<Record<string, number>>({});
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 重新读一天的数据；所有写操作之后都走这里，派生值不由页面拼 */
  const reloadDay = useCallback(async (workoutId: string): Promise<void> => {
    const detail = await repository.getWorkout(workoutId);
    if (!detail) {
      if (mountedRef.current) {
        setWorkout(null);
        setSessions([]);
      }
      return;
    }

    const daySessions = await repository.listWorkoutsByDate(detail.date);
    if (!mountedRef.current) return;
    setWorkout(detail);
    setSessions(daySessions);
  }, []);

  useEffect(() => {
    if (id === undefined || id === '') {
      setLoading(false);
      setError('缺少训练 id。');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await initDataLayer();
        const detail = await repository.getWorkout(id);
        if (cancelled) return;

        if (!detail) {
          setError('找不到这次训练，可能已经被删除了。');
          setWorkout(null);
          return;
        }

        const [daySessions, supplementRows, muscleRows, exerciseRows] = await Promise.all([
          repository.listWorkoutsByDate(detail.date),
          repository.listSupplementRecords({ date: detail.date }),
          repository.listMuscles(),
          repository.listExercises(),
        ]);
        if (cancelled) return;

        setWorkout(detail);
        setSessions(daySessions);
        setSupplements(supplementRows);
        setMuscles(muscleRows);
        setExercises(exerciseRows);
        setSlotsByExerciseId(
          Object.fromEntries(exerciseRows.map((exercise) => [exercise.id, exercise.weightSlots])),
        );
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '读取训练详情失败。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /**
   * 写操作统一包一层：先置 saving、出错落到 error，成功后重读这一天。
   */
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<void> => {
      if (id === undefined || id === '') return;

      setSaving(true);
      setError(null);
      try {
        await action();
        await reloadDay(id);
      } catch (caught) {
        if (mountedRef.current) {
          setError(caught instanceof Error ? caught.message : '保存失败，请重试。');
        }
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [id, reloadDay],
  );

  const update = useCallback(
    async (workoutId: string, patch: UpdateWorkoutInput): Promise<void> => {
      await run(() => repository.updateWorkout(workoutId, patch));
    },
    [run],
  );

  const updateSet = useCallback(
    async (setId: string, patch: WorkoutSetPatch): Promise<void> => {
      await run(() => repository.updateSet(setId, patch));
    },
    [run],
  );

  const removeSet = useCallback(
    async (setId: string): Promise<void> => {
      await run(() => repository.removeSet(setId));
    },
    [run],
  );

  /** 新一组沿用上一组的重量 / 次数 / 休息，没有上一组就给个能直接改的默认值 */
  const addSet = useCallback(
    async (workoutExerciseId: string): Promise<void> => {
      await run(async () => {
        const detail = await repository.getWorkout(id ?? '');
        const entry = detail?.exercises.find((item) => item.id === workoutExerciseId);
        const last = entry?.sets[entry.sets.length - 1];

        await repository.addSet(
          workoutExerciseId,
          last
            ? {
                weight: last.weight,
                dropWeights: last.dropWeights ?? [],
                weightUnit: last.weightUnit,
                reps: last.reps,
                restSeconds: last.restSeconds,
              }
            : { weight: 20, reps: 10 },
        );
      });
    },
    [id, run],
  );

  const addExercise = useCallback(
    async (workoutId: string, exerciseId: string): Promise<void> => {
      await run(() => repository.addWorkoutExercise(workoutId, { exerciseId }));
    },
    [run],
  );

  const createExercise = useCallback(
    async (workoutId: string, input: CreateExerciseInput): Promise<void> => {
      await run(async () => {
        const created = await repository.createExercise(input);
        await repository.addWorkoutExercise(workoutId, { exerciseId: created.id });
      });
    },
    [run],
  );

  const removeWorkout = useCallback(
    async (workoutId: string): Promise<void> => {
      setRemoving(true);
      setError(null);
      try {
        await repository.deleteWorkout(workoutId);
        if (id !== undefined && id !== '') await reloadDay(id);
      } catch (caught) {
        if (mountedRef.current) {
          setError(caught instanceof Error ? caught.message : '删除失败，请重试。');
        }
      } finally {
        if (mountedRef.current) setRemoving(false);
      }
    },
    [id, reloadDay],
  );

  return {
    loading,
    workout,
    sessions,
    supplements,
    slotsByExerciseId,
    muscles,
    exercises,
    error,
    removing,
    saving,
    update,
    updateSet,
    removeSet,
    addExercise,
    createExercise,
    addSet,
    removeWorkout,
  };
}
