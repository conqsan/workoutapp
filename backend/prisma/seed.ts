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

  for (const supplement of supplements) {
    await prisma.supplement.upsert({
      where: { name: supplement.name },
      update: {},
      create: { name: supplement.name, unit: supplement.unit, isDefault: true },
    });
  }

  const after = await prisma.supplement.count();
  console.log(`  补剂：新增 ${after - before} 个，共 ${after} 个`);
}

async function main(): Promise<void> {
  console.log(`[seed] 读取默认数据：${DEFAULTS_DIR}`);

  const muscleIdByName = await seedMuscles();
  await seedExercises(muscleIdByName);
  await seedSupplements();

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
