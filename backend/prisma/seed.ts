/**
 * 默认数据初始化。
 *
 * 数据来源是仓库根目录的 shared/defaults/*.json —— 前后端共用同一份定义，
 * 避免「后端 seed 一套、前端内置一套」最后漂移。
 *
 * 设计原则：**只新增，不覆盖**。
 * 所有写入都用 upsert + update: {}，重复执行不会产生重复数据，也不会把用户
 * 后来改过的记录（比如给默认动作加了描述）改回去。
 *
 * 执行：npm run db:seed
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { serializeUnits } from '../src/utils/supplementUnits';

const prisma = new PrismaClient();

const DEFAULTS_DIR = path.join(__dirname, '..', '..', 'shared', 'defaults');

interface MuscleSeed {
  name: string;
  sortOrder: number;
}

interface ExerciseSeed {
  muscle: string;
  name: string;
  description?: string | null;
}

interface SupplementSeed {
  name: string;
  unit: string;
  /** 可选单位（第一项是默认值），例如蛋白粉 ['g', '勺'] */
  units?: string[];
}

function loadDefaults<T>(fileName: string): T {
  const filePath = path.join(DEFAULTS_DIR, fileName);
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

async function seedMuscles(): Promise<Map<string, number>> {
  const muscles = loadDefaults<MuscleSeed[]>('muscles.json');
  const before = await prisma.muscle.count();

  for (const muscle of muscles) {
    await prisma.muscle.upsert({
      where: { name: muscle.name },
      update: {},
      create: { name: muscle.name, sortOrder: muscle.sortOrder },
    });
  }

  const rows = await prisma.muscle.findMany({ select: { id: true, name: true } });
  const after = rows.length;

  console.log(`  训练部位：新增 ${after - before} 个，共 ${after} 个`);

  return new Map(rows.map((row) => [row.name, row.id]));
}

async function seedExercises(muscleIdByName: Map<string, number>): Promise<void> {
  const exercises = loadDefaults<ExerciseSeed[]>('exercises.json');
  const before = await prisma.exercise.count();

  for (const exercise of exercises) {
    const muscleId = muscleIdByName.get(exercise.muscle);
    if (muscleId === undefined) {
      throw new Error(
        `exercises.json 里的部位「${exercise.muscle}」在 muscles.json 中不存在，请先补齐部位定义。`,
      );
    }

    await prisma.exercise.upsert({
      where: { muscleId_name: { muscleId, name: exercise.name } },
      update: {},
      create: {
        name: exercise.name,
        muscleId,
        description: exercise.description ?? null,
        isCustom: false,
      },
    });
  }

  const after = await prisma.exercise.count();
  console.log(`  训练动作：新增 ${after - before} 个，共 ${after} 个`);
}

async function seedSupplements(): Promise<void> {
  const supplements = loadDefaults<SupplementSeed[]>('supplements.json');
  const before = await prisma.supplement.count();
  let backfilled = 0;

  for (const supplement of supplements) {
    const units = serializeUnits(supplement.units, supplement.unit);
    const existing = await prisma.supplement.findUnique({ where: { name: supplement.name } });

    if (!existing) {
      await prisma.supplement.create({
        data: { name: supplement.name, unit: supplement.unit, units, isDefault: true },
      });
      continue;
    }

    // 只补「空的 units」：从老版本升级上来的这列是默认值 '[]'，
    // 而用户自己改过的单位列表不动 —— 和前端 syncDefaults 一个原则：只补不覆盖。
    if (existing.units === '' || existing.units === '[]') {
      await prisma.supplement.update({ where: { id: existing.id }, data: { units } });
      backfilled += 1;
    }
  }

  const after = await prisma.supplement.count();
  const suffix = backfilled > 0 ? `，补齐 ${backfilled} 个的可选单位` : '';
  console.log(`  补剂：新增 ${after - before} 个，共 ${after} 个${suffix}`);
}

/**
 * 清掉已经从 shared/defaults 里移除的默认数据。
 *
 * 只删「默认的（isCustom = false）」且「没有任何引用」的：
 * 用户自建的动作不动，出现在训练记录里的动作也不动（历史不能丢）。
 * 例如把「高位下拉」拆成（正握/反握）两个之后，旧的「高位下拉」会被清掉；
 * 而删掉「小腿」这个部位时，因为它下面一个动作都没有，也会被清掉。
 */
async function removeStaleDefaults(): Promise<void> {
  const muscleSeeds = loadDefaults<MuscleSeed[]>('muscles.json');
  const exerciseSeeds = loadDefaults<ExerciseSeed[]>('exercises.json');

  const keepMuscles = new Set(muscleSeeds.map((muscle) => muscle.name));
  const keepExercises = new Set(
    exerciseSeeds.map((exercise) => `${exercise.muscle}\u0000${exercise.name}`),
  );

  // 1) 已经被移除的默认动作
  const existingExercises = await prisma.exercise.findMany({
    where: { isCustom: false },
    select: { id: true, name: true, muscle: { select: { name: true } } },
  });

  let removedExercises = 0;
  for (const row of existingExercises) {
    if (keepExercises.has(`${row.muscle.name}\u0000${row.name}`)) continue;
    const used = await prisma.workoutExercise.count({ where: { exerciseId: row.id } });
    if (used > 0) continue;
    await prisma.exercise.delete({ where: { id: row.id } });
    removedExercises += 1;
  }

  // 2) 已经被移除的部位（只删下面一个动作都没有的）
  const existingMuscles = await prisma.muscle.findMany({
    include: { _count: { select: { exercises: true } } },
  });

  let removedMuscles = 0;
  for (const muscle of existingMuscles) {
    if (keepMuscles.has(muscle.name)) continue;
    if (muscle._count.exercises > 0) continue;
    await prisma.muscle.delete({ where: { id: muscle.id } });
    removedMuscles += 1;
  }

  if (removedExercises > 0 || removedMuscles > 0) {
    console.log(`  清理已移除的默认数据：动作 ${removedExercises} 个、部位 ${removedMuscles} 个`);
  }
}

async function main(): Promise<void> {
  console.log(`[seed] 读取默认数据：${DEFAULTS_DIR}`);

  const muscleIdByName = await seedMuscles();
  await seedExercises(muscleIdByName);
  await seedSupplements();
  await removeStaleDefaults();

  console.log('[seed] 完成。');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('[seed] 失败：', error);
    await prisma.$disconnect();
    process.exit(1);
  });
