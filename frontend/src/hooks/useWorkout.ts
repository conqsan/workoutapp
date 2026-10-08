import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initDataLayer, repository } from '@/data';
import type { LastWorkoutSummary, WorkoutDetail, WorkoutSetInput, WorkoutSetPatch } from '@/data';

export interface UseWorkoutResult {
  loading: boolean;
  /** 进行中或刚完成的训练；没有则为 null */
  workout: WorkoutDetail | null;
  lastWorkouts: Record<string, LastWorkoutSummary | null>;
  error: string | null;
  saving: boolean;
  clearError: () => void;
  start: (date?: string) => Promise<void>;
  complete: () => Promise<void>;
  discard: () => Promise<void>;
  setNote: (note: string) => Promise<void>;
  addExercise: (exerciseId: string) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;
  moveExercise: (id: string, direction: 'up' | 'down') => Promise<void>;
  setExerciseNote: (id: string, note: string) => Promise<void>;
  addSet: (workoutExerciseId: string, input: WorkoutSetInput) => Promise<void>;
  copyLastSet: (workoutExerciseId: string) => Promise<void>;
  updateSet: (id: string, patch: WorkoutSetPatch) => Promise<void>;
  removeSet: (id: string) => Promise<void>;
  copyLastWorkout: (workoutExerciseId: string) => Promise<void>;
}

/**
 * 训练页的状态与动作。
 *
 * 所有写操作都通过 repository（目前是 IndexedDB）落盘，并且每个写操作都返回
 * 更新后的整次训练 —— 所以写完之后直接 setWorkout(返回值) 即可，不用手动拼状态。
 */
export function useWorkout(): UseWorkoutResult {
  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [lastWorkouts, setLastWorkouts] = useState<Record<string, LastWorkoutSummary | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 防止组件卸载后还在 setState
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (action: () => Promise<WorkoutDetail | null | undefined>): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        const result = await action();
        if (mountedRef.current && result) {
          setWorkout(result);
        }
      } catch (caught) {
        if (mountedRef.current) {
          setError(caught instanceof Error ? caught.message : '操作失败，请重试。');
        }
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      try {
        await initDataLayer();
        const active = await repository.getActiveWorkout();
        if (mountedRef.current) setWorkout(active);
      } catch (caught) {
        if (mountedRef.current) {
          setError(caught instanceof Error ? caught.message : '读取本地数据失败。');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, []);

  // 只在「动作集合」变化时去查历史，避免每改一次重量都重查一遍
  const exerciseKey = useMemo(
    () => workout?.exercises.map((exercise) => exercise.exerciseId).join(',') ?? '',
    [workout],
  );

  useEffect(() => {
    if (!workout || exerciseKey.length === 0) {
      setLastWorkouts({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        workout.exercises.map(async (exercise) => {
          const last = await repository.getLastWorkout(exercise.exerciseId);
          return [exercise.exerciseId, last] as const;
        }),
      );
      if (!cancelled) {
        setLastWorkouts(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
    // workout.exercises 的 identity 每次都变，这里刻意只依赖 exerciseKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseKey]);

  const start = useCallback(
    async (date?: string) => {
      await run(() => repository.startWorkout(date === undefined ? undefined : { date }));
    },
    [run],
  );

  const complete = useCallback(async () => {
    if (!workout) return;
    await run(() => repository.completeWorkout(workout.id));
  }, [run, workout]);

  const discard = useCallback(async () => {
    if (!workout) return;
    setSaving(true);
    setError(null);
    try {
      await repository.deleteWorkout(workout.id);
      if (mountedRef.current) setWorkout(null);
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : '删除失败，请重试。');
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [workout]);

  const setNote = useCallback(
    async (note: string) => {
      if (!workout) return;
      await run(() => repository.updateWorkoutNote(workout.id, note));
    },
    [run, workout],
  );

  const addExercise = useCallback(
    async (exerciseId: string) => {
      if (!workout) return;
      await run(() => repository.addWorkoutExercise(workout.id, { exerciseId }));
    },
    [run, workout],
  );

  const removeExercise = useCallback(
    async (id: string) => {
      await run(() => repository.removeWorkoutExercise(id));
    },
    [run],
  );

  const moveExercise = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      await run(() => repository.moveWorkoutExercise(id, direction));
    },
    [run],
  );

  const setExerciseNote = useCallback(
    async (id: string, note: string) => {
      await run(() => repository.setWorkoutExerciseNote(id, note));
    },
    [run],
  );

  const addSet = useCallback(
    async (workoutExerciseId: string, input: WorkoutSetInput) => {
      await run(() => repository.addSet(workoutExerciseId, input));
    },
    [run],
  );

  const copyLastSet = useCallback(
    async (workoutExerciseId: string) => {
      await run(() => repository.copyLastSet(workoutExerciseId));
    },
    [run],
  );

  const updateSet = useCallback(
    async (id: string, patch: WorkoutSetPatch) => {
      await run(() => repository.updateSet(id, patch));
    },
    [run],
  );

  const removeSet = useCallback(
    async (id: string) => {
      await run(() => repository.removeSet(id));
    },
    [run],
  );

  const copyLastWorkout = useCallback(
    async (workoutExerciseId: string) => {
      await run(() => repository.copyLastWorkout(workoutExerciseId));
    },
    [run],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    workout,
    lastWorkouts,
    error,
    saving,
    clearError,
    start,
    complete,
    discard,
    setNote,
    addExercise,
    removeExercise,
    moveExercise,
    setExerciseNote,
    addSet,
    copyLastSet,
    updateSet,
    removeSet,
    copyLastWorkout,
  };
}
