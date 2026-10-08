import {
  getAll,
  getAllByIndex,
  get,
  put,
  putMany,
  remove,
  request,
  runTransaction,
  Store,
  type StoreName,
} from './db';
import { createId, todayKey } from './ids';
import {
  APP_VERSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  planImport,
  type BackupData,
  type BackupSnapshot,
  type BackupWorkout,
  type ImportResult,
} from './backup';
import { calculateTotalVolumeKg } from '@/utils/weight';
import type {
  AddWorkoutExerciseInput,
  CreateExerciseInput,
  Exercise,
  FitLogRepository,
  LastWorkoutSummary,
  Muscle,
  StartWorkoutInput,
  Supplement,
  SupplementRecord,
  SupplementRecordInput,
  SupplementRecordPatch,
  SupplementRecordWithSupplement,
  Workout,
  WorkoutSummary,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutExerciseWithSets,
  WorkoutSet,
  WorkoutSetInput,
  WorkoutSetPatch,
  CreateSupplementInput,
} from './types';

function nowIso(): string {
  return new Date().toISOString();
}

async function loadSets(workoutExerciseId: string): Promise<WorkoutSet[]> {
  const sets = await getAllByIndex<WorkoutSet>(
    Store.workoutSets,
    'workoutExerciseId',
    workoutExerciseId,
  );
  return sets.sort((a, b) => a.setNumber - b.setNumber);
}

async function loadEntries(workoutId: string): Promise<WorkoutExercise[]> {
  const entries = await getAllByIndex<WorkoutExercise>(
    Store.workoutExercises,
    'workoutId',
    workoutId,
  );
  return entries.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 把训练拼成 UI 直接可用的结构（动作、每组、总量都算好） */
async function toDetail(workout: Workout): Promise<WorkoutDetail> {
  const entries = await loadEntries(workout.id);
  const exercises: WorkoutExerciseWithSets[] = [];

  for (const entry of entries) {
    exercises.push({ ...entry, sets: await loadSets(entry.id) });
  }

  const allSets = exercises.flatMap((exercise) => exercise.sets);

  return {
    ...workout,
    exercises,
    totalSets: allSets.length,
    // 混着 kg / lb 的组不能直接相加，先统一换算成 kg
    totalVolume: calculateTotalVolumeKg(allSets),
  };
}

/**
 * 读出全部数据，拼成备份用的形状（训练里嵌动作、动作里嵌组）。
 *
 * 和 listWorkouts 一样是「三张表各查一次再在内存里聚合」，不做 N+1。
 * 导出时按日期升序排 —— 备份文件用文本 diff 看的话，顺序稳定才好比较。
 */
async function readBackupData(): Promise<BackupData> {
  const [muscles, exercises, supplements, supplementRecords, workouts, entries, sets] =
    await Promise.all([
      getAll<Muscle>(Store.muscles),
      getAll<Exercise>(Store.exercises),
      getAll<Supplement>(Store.supplements),
      getAll<SupplementRecord>(Store.supplementRecords),
      getAll<Workout>(Store.workouts),
      getAll<WorkoutExercise>(Store.workoutExercises),
      getAll<WorkoutSet>(Store.workoutSets),
    ]);

  const setsByEntry = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const bucket = setsByEntry.get(set.workoutExerciseId);
    if (bucket) bucket.push(set);
    else setsByEntry.set(set.workoutExerciseId, [set]);
  }

  const entriesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const entry of entries) {
    const bucket = entriesByWorkout.get(entry.workoutId);
    if (bucket) bucket.push(entry);
    else entriesByWorkout.set(entry.workoutId, [entry]);
  }

  const backupWorkouts: BackupWorkout[] = workouts
    .map((workout) => ({
      ...workout,
      exercises: (entriesByWorkout.get(workout.id) ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((entry) => ({
          ...entry,
          sets: (setsByEntry.get(entry.id) ?? []).slice().sort((a, b) => a.setNumber - b.setNumber),
        })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  return {
    muscles: muscles.slice().sort(compareMuscles),
    exercises: exercises.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    supplements: supplements.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    supplementRecords: supplementRecords
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    workouts: backupWorkouts,
  };
}

async function requireWorkout(id: string): Promise<Workout> {
  const workout = await get<Workout>(Store.workouts, id);
  if (!workout) {
    throw new Error('找不到这次训练，可能已经被删除了。');
  }
  return workout;
}

async function requireEntry(id: string): Promise<WorkoutExercise> {
  const entry = await get<WorkoutExercise>(Store.workoutExercises, id);
  if (!entry) {
    throw new Error('找不到这个动作，可能已经被删除了。');
  }
  return entry;
}

async function requireSet(id: string): Promise<WorkoutSet> {
  const set = await get<WorkoutSet>(Store.workoutSets, id);
  if (!set) {
    throw new Error('找不到这一组，可能已经被删除了。');
  }
  return set;
}

/** 删掉中间某一组之后把组号压成 1..n，避免出现「第1组、第3组」 */
async function renumberSets(workoutExerciseId: string): Promise<void> {
  const sets = await loadSets(workoutExerciseId);
  const renumbered = sets.map((set, index) => ({ ...set, setNumber: index + 1 }));
  await putMany(Store.workoutSets, renumbered);
}

function compareMuscles(a: Muscle, b: Muscle): number {
  return a.sortOrder - b.sortOrder;
}

/** 补剂记录展示用：把补剂名称和默认标记补上 */
async function toRecordView(row: SupplementRecord): Promise<SupplementRecordWithSupplement> {
  const supplement = await get<Supplement>(Store.supplements, row.supplementId);
  return {
    ...row,
    supplementName: supplement?.name ?? '已删除的补剂',
    isDefault: supplement?.isDefault ?? false,
  };
}

export function createLocalRepository(): FitLogRepository {
  async function listMuscles(): Promise<Muscle[]> {
    const muscles = await getAll<Muscle>(Store.muscles);
    return muscles.sort(compareMuscles);
  }

  async function listExercises(muscleId?: string): Promise<Exercise[]> {
    const [exercises, muscles] = await Promise.all([
      muscleId === undefined
        ? getAll<Exercise>(Store.exercises)
        : getAllByIndex<Exercise>(Store.exercises, 'muscleId', muscleId),
      listMuscles(),
    ]);

    const muscleOrder = new Map(muscles.map((muscle, index) => [muscle.id, index]));

    return exercises.sort((a, b) => {
      const muscleDiff = (muscleOrder.get(a.muscleId) ?? 0) - (muscleOrder.get(b.muscleId) ?? 0);
      return muscleDiff !== 0 ? muscleDiff : a.sortOrder - b.sortOrder;
    });
  }

  async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
    const name = input.name.trim();
    if (name.length === 0) {
      throw new Error('动作名称不能为空。');
    }

    const muscle = await get<Muscle>(Store.muscles, input.muscleId);
    if (!muscle) {
      throw new Error('请选择训练部位。');
    }

    const sameMuscle = await getAllByIndex<Exercise>(Store.exercises, 'muscleId', input.muscleId);
    if (sameMuscle.some((exercise) => exercise.name === name)) {
      throw new Error(`「${muscle.name}」下已经有同名动作「${name}」了。`);
    }

    const exercise: Exercise = {
      id: createId('e'),
      name,
      muscleId: input.muscleId,
      description: input.description?.trim() || null,
      isCustom: true,
      // 自定义动作排在默认动作后面
      sortOrder: 10_000 + (Date.now() % 10_000),
    };

    await put(Store.exercises, exercise);
    return exercise;
  }

  // -------------------------------------------------------------- 补剂

  async function listSupplements(): Promise<Supplement[]> {
    const supplements = await getAll<Supplement>(Store.supplements);
    return supplements.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async function createSupplement(input: CreateSupplementInput): Promise<Supplement> {
    const name = input.name.trim();
    if (name.length === 0) {
      throw new Error('补剂名称不能为空。');
    }

    const existing = await listSupplements();
    if (existing.some((supplement) => supplement.name === name)) {
      throw new Error(`已经有叫「${name}」的补剂了。`);
    }

    const supplement: Supplement = {
      id: createId('sup'),
      name,
      unit: input.unit?.trim() || 'g',
      isDefault: false,
      sortOrder: 10_000 + (Date.now() % 10_000),
    };

    await put(Store.supplements, supplement);
    return supplement;
  }

  async function listSupplementRecords(filter?: {
    date?: string;
    supplementId?: string;
  }): Promise<SupplementRecordWithSupplement[]> {
    const all = await getAll<SupplementRecord>(Store.supplementRecords);
    const filtered = all.filter((record) => {
      if (filter?.date !== undefined && record.date !== filter.date) return false;
      if (filter?.supplementId !== undefined && record.supplementId !== filter.supplementId) {
        return false;
      }
      return true;
    });

    // 日期倒序；同一天按录入先后
    filtered.sort((a, b) => b.date.localeCompare(a.date) || a.createdAt.localeCompare(b.createdAt));

    // 补剂名只查一次再在内存里配对：之前是每条记录查一次库，
    // 一个月的记录就是几十次独立事务，白白慢在 IO 上
    const supplements = await getAll<Supplement>(Store.supplements);
    const supplementById = new Map(supplements.map((item) => [item.id, item]));

    return filtered.map((record) => {
      const supplement = supplementById.get(record.supplementId);
      return {
        ...record,
        supplementName: supplement?.name ?? '已删除的补剂',
        isDefault: supplement?.isDefault ?? false,
      };
    });
  }

  async function addSupplementRecord(
    input: SupplementRecordInput,
  ): Promise<SupplementRecordWithSupplement> {
    const supplement = await get<Supplement>(Store.supplements, input.supplementId);
    if (!supplement) {
      throw new Error('请选择补剂。');
    }

    const record: SupplementRecord = {
      id: createId('sr'),
      supplementId: input.supplementId,
      date: input.date ?? todayKey(),
      amount: input.amount,
      // 没写单位就跟随补剂自身的单位，避免出现没单位的记录
      unit: input.unit?.trim() || supplement.unit,
      consumptionTime: input.consumptionTime?.trim() ?? '',
      note: input.note?.trim() ?? '',
      createdAt: nowIso(),
    };

    await put(Store.supplementRecords, record);
    return toRecordView(record);
  }

  async function updateSupplementRecord(
    id: string,
    patch: SupplementRecordPatch,
  ): Promise<SupplementRecordWithSupplement> {
    const current = await get<SupplementRecord>(Store.supplementRecords, id);
    if (!current) {
      throw new Error('找不到这条补剂记录，可能已经被删除了。');
    }

    if (patch.supplementId !== undefined) {
      const supplement = await get<Supplement>(Store.supplements, patch.supplementId);
      if (!supplement) {
        throw new Error('请选择补剂。');
      }
    }

    const updated: SupplementRecord = {
      ...current,
      ...(patch.supplementId === undefined ? {} : { supplementId: patch.supplementId }),
      ...(patch.date === undefined ? {} : { date: patch.date }),
      ...(patch.amount === undefined ? {} : { amount: patch.amount }),
      ...(patch.unit === undefined ? {} : { unit: patch.unit }),
      ...(patch.consumptionTime === undefined ? {} : { consumptionTime: patch.consumptionTime }),
      ...(patch.note === undefined ? {} : { note: patch.note }),
    };

    await put(Store.supplementRecords, updated);
    return toRecordView(updated);
  }

  async function removeSupplementRecord(id: string): Promise<void> {
    await remove(Store.supplementRecords, id);
  }

  // -------------------------------------------------------------- 训练

  async function getActiveWorkout(): Promise<WorkoutDetail | null> {
    const actives = await getAllByIndex<Workout>(Store.workouts, 'status', 'active');
    const latest = actives.sort((a, b) => b.startTime.localeCompare(a.startTime))[0];
    return latest ? toDetail(latest) : null;
  }

  async function getWorkout(id: string): Promise<WorkoutDetail | null> {
    const workout = await get<Workout>(Store.workouts, id);
    return workout ? toDetail(workout) : null;
  }

  /**
   * 一次读出全部训练（含明细）。
   * 三张表各查一次再在内存里聚合，避免「每个训练查三次」的 N+1 问题。
   */
  async function listWorkouts(): Promise<WorkoutDetail[]> {
    const [workouts, entries, sets] = await Promise.all([
      getAll<Workout>(Store.workouts),
      getAll<WorkoutExercise>(Store.workoutExercises),
      getAll<WorkoutSet>(Store.workoutSets),
    ]);

    const setsByEntry = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const bucket = setsByEntry.get(set.workoutExerciseId);
      if (bucket) bucket.push(set);
      else setsByEntry.set(set.workoutExerciseId, [set]);
    }

    const entriesByWorkout = new Map<string, WorkoutExercise[]>();
    for (const entry of entries) {
      const bucket = entriesByWorkout.get(entry.workoutId);
      if (bucket) bucket.push(entry);
      else entriesByWorkout.set(entry.workoutId, [entry]);
    }

    return workouts
      .map((workout) => {
        const workoutEntries = (entriesByWorkout.get(workout.id) ?? []).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        const exercises: WorkoutExerciseWithSets[] = workoutEntries.map((entry) => ({
          ...entry,
          sets: (setsByEntry.get(entry.id) ?? []).sort((a, b) => a.setNumber - b.setNumber),
        }));
        const allSets = exercises.flatMap((exercise) => exercise.sets);

        return {
          ...workout,
          exercises,
          totalSets: allSets.length,
          totalVolume: calculateTotalVolumeKg(allSets),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  }

  /** 历史列表用的摘要，直接由 listWorkouts 派生，保证两边口径一致 */
  async function listWorkoutSummaries(): Promise<WorkoutSummary[]> {
    const workouts = await listWorkouts();
    return workouts.map((workout) => ({
      id: workout.id,
      date: workout.date,
      status: workout.status,
      startTime: workout.startTime,
      endTime: workout.endTime,
      muscleNames: Array.from(
        new Set(workout.exercises.map((entry) => entry.muscleName).filter((name) => name !== '')),
      ),
      exerciseCount: workout.exercises.length,
      setCount: workout.totalSets,
      totalVolume: workout.totalVolume,
      note: workout.note,
    }));
  }

  async function startWorkout(input?: StartWorkoutInput): Promise<WorkoutDetail> {
    const active = await getActiveWorkout();
    if (active) {
      throw new Error('已经有一次进行中的训练了。');
    }

    const timestamp = nowIso();
    const workout: Workout = {
      id: createId('w'),
      date: input?.date ?? todayKey(),
      startTime: timestamp,
      endTime: null,
      note: input?.note ?? '',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await put(Store.workouts, workout);
    return toDetail(workout);
  }

  async function updateWorkoutNote(id: string, note: string): Promise<WorkoutDetail> {
    const workout = await requireWorkout(id);
    const updated: Workout = { ...workout, note, updatedAt: nowIso() };
    await put(Store.workouts, updated);
    return toDetail(updated);
  }

  async function deleteWorkout(id: string): Promise<void> {
    const entries = await loadEntries(id);
    const setIds: string[] = [];
    for (const entry of entries) {
      const sets = await loadSets(entry.id);
      setIds.push(...sets.map((set) => set.id));
    }

    await runTransaction(
      [Store.workouts, Store.workoutExercises, Store.workoutSets],
      'readwrite',
      async (tx) => {
        // 删除顺序无所谓，但都在同一个事务里，不会留下孤儿数据
        for (const setId of setIds) {
          await request(tx.objectStore(Store.workoutSets).delete(setId));
        }
        for (const entry of entries) {
          await request(tx.objectStore(Store.workoutExercises).delete(entry.id));
        }
        await request(tx.objectStore(Store.workouts).delete(id));
      },
    );
  }

  async function completeWorkout(id: string): Promise<WorkoutDetail> {
    const workout = await requireWorkout(id);
    if (workout.status === 'completed') {
      throw new Error('这次训练已经完成过了。');
    }

    const detail = await toDetail(workout);
    if (detail.exercises.length === 0) {
      throw new Error('这次训练还没有任何动作，先加一个动作再完成。');
    }

    // 完成训练 = 所有组都算做完，不留半截的未完成组
    const finishedSets = detail.exercises
      .flatMap((exercise) => exercise.sets)
      .filter((set) => !set.completed)
      .map((set) => ({ ...set, completed: true }));

    if (finishedSets.length > 0) {
      await putMany(Store.workoutSets, finishedSets);
    }

    const updated: Workout = {
      ...workout,
      status: 'completed',
      endTime: nowIso(),
      updatedAt: nowIso(),
    };
    await put(Store.workouts, updated);

    return toDetail(updated);
  }

  // -------------------------------------------------------------- 训练里的动作

  async function addWorkoutExercise(
    workoutId: string,
    input: AddWorkoutExerciseInput,
  ): Promise<WorkoutDetail> {
    const workout = await requireWorkout(workoutId);
    const exercise = await get<Exercise>(Store.exercises, input.exerciseId);
    if (!exercise) {
      throw new Error('这个动作不存在，请刷新后重试。');
    }
    const muscle = await get<Muscle>(Store.muscles, exercise.muscleId);

    const entries = await loadEntries(workoutId);
    const lastSortOrder = entries[entries.length - 1]?.sortOrder ?? -1;

    const entry: WorkoutExercise = {
      id: createId('we'),
      workoutId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleId: exercise.muscleId,
      muscleName: muscle?.name ?? '',
      sortOrder: lastSortOrder + 1,
      note: '',
      createdAt: nowIso(),
    };

    await put(Store.workoutExercises, entry);
    return toDetail(workout);
  }

  async function removeWorkoutExercise(id: string): Promise<WorkoutDetail> {
    const entry = await requireEntry(id);
    const sets = await loadSets(id);

    await runTransaction([Store.workoutExercises, Store.workoutSets], 'readwrite', async (tx) => {
      await request(tx.objectStore(Store.workoutExercises).delete(id));
      for (const set of sets) {
        await request(tx.objectStore(Store.workoutSets).delete(set.id));
      }
    });

    return toDetail(await requireWorkout(entry.workoutId));
  }

  async function moveWorkoutExercise(id: string, direction: 'up' | 'down'): Promise<WorkoutDetail> {
    const entry = await requireEntry(id);
    const entries = await loadEntries(entry.workoutId);
    const index = entries.findIndex((item) => item.id === id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= entries.length) {
      return toDetail(await requireWorkout(entry.workoutId));
    }

    const reordered = [...entries];
    const [moved] = reordered.splice(index, 1);
    if (moved) {
      reordered.splice(targetIndex, 0, moved);
    }

    await putMany(
      Store.workoutExercises,
      reordered.map((item, position) => ({ ...item, sortOrder: position })),
    );

    return toDetail(await requireWorkout(entry.workoutId));
  }

  async function setWorkoutExerciseNote(id: string, note: string): Promise<WorkoutDetail> {
    const entry = await requireEntry(id);
    await put(Store.workoutExercises, { ...entry, note });
    return toDetail(await requireWorkout(entry.workoutId));
  }

  // -------------------------------------------------------------- 训练组

  async function appendSet(
    workoutExerciseId: string,
    input: WorkoutSetInput,
  ): Promise<WorkoutDetail> {
    const entry = await requireEntry(workoutExerciseId);
    const sets = await loadSets(workoutExerciseId);
    const lastSetNumber = sets[sets.length - 1]?.setNumber ?? 0;

    const set: WorkoutSet = {
      id: createId('s'),
      workoutExerciseId,
      setNumber: lastSetNumber + 1,
      weight: input.weight,
      weightUnit: input.weightUnit ?? 'kg',
      reps: input.reps,
      restSeconds: input.restSeconds ?? null,
      note: input.note ?? '',
      completed: input.completed ?? true,
      createdAt: nowIso(),
    };

    await put(Store.workoutSets, set);
    return toDetail(await requireWorkout(entry.workoutId));
  }

  async function addSet(workoutExerciseId: string, input: WorkoutSetInput): Promise<WorkoutDetail> {
    return appendSet(workoutExerciseId, input);
  }

  /** 复制上一组：沿用上一组的重量 / 次数 / 休息，组号顺延 */
  async function copyLastSet(workoutExerciseId: string): Promise<WorkoutDetail> {
    const sets = await loadSets(workoutExerciseId);
    const lastSet = sets[sets.length - 1];
    if (!lastSet) {
      throw new Error('这个动作还没有任何组，先添加一组。');
    }

    return appendSet(workoutExerciseId, {
      weight: lastSet.weight,
      weightUnit: lastSet.weightUnit,
      reps: lastSet.reps,
      restSeconds: lastSet.restSeconds,
    });
  }

  async function updateSet(id: string, patch: WorkoutSetPatch): Promise<WorkoutDetail> {
    const set = await requireSet(id);
    const entry = await requireEntry(set.workoutExerciseId);

    const updated: WorkoutSet = {
      ...set,
      ...(patch.weight === undefined ? {} : { weight: patch.weight }),
      ...(patch.weightUnit === undefined ? {} : { weightUnit: patch.weightUnit }),
      ...(patch.reps === undefined ? {} : { reps: patch.reps }),
      ...(patch.restSeconds === undefined ? {} : { restSeconds: patch.restSeconds }),
      ...(patch.note === undefined ? {} : { note: patch.note }),
      ...(patch.completed === undefined ? {} : { completed: patch.completed }),
    };

    await put(Store.workoutSets, updated);
    return toDetail(await requireWorkout(entry.workoutId));
  }

  async function removeSet(id: string): Promise<WorkoutDetail> {
    const set = await requireSet(id);
    const entry = await requireEntry(set.workoutExerciseId);

    await remove(Store.workoutSets, id);
    await renumberSets(set.workoutExerciseId);

    return toDetail(await requireWorkout(entry.workoutId));
  }

  /** 复制上一次训练：把历史那几组的重量次数，一次性加成这次的组 */
  async function copyLastWorkout(workoutExerciseId: string): Promise<WorkoutDetail> {
    const entry = await requireEntry(workoutExerciseId);
    const last = await getLastWorkout(entry.exerciseId);
    if (!last || last.sets.length === 0) {
      throw new Error('这个动作还没有历史记录，先自己记一组吧。');
    }

    const sets = await loadSets(workoutExerciseId);
    let nextNumber = (sets[sets.length - 1]?.setNumber ?? 0) + 1;
    const baseTime = nowIso();

    const created: WorkoutSet[] = last.sets.map((item) => {
      const set: WorkoutSet = {
        id: createId('s'),
        workoutExerciseId,
        setNumber: nextNumber,
        weight: item.weight,
        weightUnit: item.weightUnit,
        reps: item.reps,
        restSeconds: null,
        note: '',
        completed: true,
        createdAt: baseTime,
      };
      nextNumber += 1;
      return set;
    });

    await putMany(Store.workoutSets, created);
    return toDetail(await requireWorkout(entry.workoutId));
  }

  // -------------------------------------------------------------- 上一次训练

  async function getLastWorkout(exerciseId: string): Promise<LastWorkoutSummary | null> {
    const entries = await getAllByIndex<WorkoutExercise>(
      Store.workoutExercises,
      'exerciseId',
      exerciseId,
    );
    if (entries.length === 0) return null;

    const workouts = await getAll<Workout>(Store.workouts);
    const completedById = new Map(
      workouts.filter((workout) => workout.status === 'completed').map((w) => [w.id, w]),
    );

    const candidates = entries
      .map((entry) => completedById.get(entry.workoutId))
      .filter((workout): workout is Workout => workout !== undefined)
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

    const latest = candidates[0];
    if (!latest) return null;

    const latestEntry = entries.find((entry) => entry.workoutId === latest.id);
    if (!latestEntry) return null;

    const sets = await loadSets(latestEntry.id);

    return {
      date: latest.date,
      sets: sets.map((set) => ({
        setNumber: set.setNumber,
        weight: set.weight,
        weightUnit: set.weightUnit,
        reps: set.reps,
      })),
      totalVolume: calculateTotalVolumeKg(sets),
    };
  }

  // -------------------------------------------------------------- 备份与恢复

  async function exportBackup(): Promise<BackupSnapshot> {
    const data = await readBackupData();
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      appVersion: APP_VERSION,
      exportedAt: nowIso(),
      data,
    };
  }

  /**
   * 导入 = 合并（不是覆盖）。
   *
   * 本机已有的数据一律不动 —— 备份是「找回丢失的数据」，不是「用文件里的版本替换本机」。
   * 具体要写哪些行由 planImport 算好（纯函数，另有单元测试），这里只负责落库：
   * 七张表在**同一个事务**里写，中途失败不会留下半截数据。
   */
  async function importBackup(snapshot: BackupSnapshot): Promise<ImportResult> {
    const existing = await readBackupData();
    const plan = planImport(existing, snapshot.data);

    const rows: Array<readonly [StoreName, readonly unknown[]]> = [
      [Store.muscles, plan.muscles],
      [Store.exercises, plan.exercises],
      [Store.supplements, plan.supplements],
      [Store.supplementRecords, plan.supplementRecords],
      [Store.workouts, plan.workouts],
      [Store.workoutExercises, plan.workoutExercises],
      [Store.workoutSets, plan.workoutSets],
    ];

    await runTransaction(
      rows.map(([storeName]) => storeName),
      'readwrite',
      async (tx) => {
        for (const [storeName, values] of rows) {
          const store = tx.objectStore(storeName);
          for (const value of values) {
            await request(store.put(value));
          }
        }
      },
    );

    return plan.result;
  }

  return {
    listMuscles,
    listExercises,
    createExercise,
    listSupplements,
    createSupplement,
    listSupplementRecords,
    addSupplementRecord,
    updateSupplementRecord,
    removeSupplementRecord,
    getActiveWorkout,
    listWorkouts,
    listWorkoutSummaries,
    startWorkout,
    getWorkout,
    updateWorkoutNote,
    deleteWorkout,
    completeWorkout,
    addWorkoutExercise,
    removeWorkoutExercise,
    moveWorkoutExercise,
    setWorkoutExerciseNote,
    addSet,
    copyLastSet,
    updateSet,
    removeSet,
    copyLastWorkout,
    getLastWorkout,
    exportBackup,
    importBackup,
  };
}
