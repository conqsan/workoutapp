import type { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { toExerciseDto } from '../utils/dto';
import { normalizeOptionalText } from '../utils/text';
import * as exerciseRepository from '../repositories/exercise.repository';
import * as muscleRepository from '../repositories/muscle.repository';
import type { CreateExerciseInput, UpdateExerciseInput } from '../schemas/exercise.schema';
import type { ExerciseDto } from '../types/api';

export async function listExercises(muscleId?: number): Promise<ExerciseDto[]> {
  const rows = await exerciseRepository.findAll(muscleId);
  return rows.map(toExerciseDto);
}

export async function getExercise(id: number): Promise<ExerciseDto> {
  const row = await exerciseRepository.findById(id);
  if (!row) {
    throw ApiError.notFound('找不到这个动作，可能已被删除。');
  }
  return toExerciseDto(row);
}

/** 用户自建动作统一标记 isCustom = true，便于前端区分默认动作与自定义动作 */
export async function createExercise(input: CreateExerciseInput): Promise<ExerciseDto> {
  const muscle = await muscleRepository.findById(input.muscleId);
  if (!muscle) {
    throw ApiError.badRequest('训练部位不存在，请刷新后重试。');
  }

  const duplicated = await exerciseRepository.findByMuscleAndName(input.muscleId, input.name);
  if (duplicated) {
    throw ApiError.conflict(`「${muscle.name}」下已经有同名动作「${input.name}」了。`);
  }

  const row = await exerciseRepository.create({
    name: input.name,
    muscleId: input.muscleId,
    description: normalizeOptionalText(input.description) ?? null,
    isCustom: true,
  });

  return toExerciseDto(row);
}

export async function updateExercise(id: number, input: UpdateExerciseInput): Promise<ExerciseDto> {
  const current = await exerciseRepository.findById(id);
  if (!current) {
    throw ApiError.notFound('找不到这个动作，可能已被删除。');
  }

  const nextMuscleId = input.muscleId ?? current.muscleId;
  const nextName = input.name ?? current.name;

  if (input.muscleId !== undefined) {
    const muscle = await muscleRepository.findById(input.muscleId);
    if (!muscle) {
      throw ApiError.badRequest('训练部位不存在，请刷新后重试。');
    }
  }

  // 名称或部位变了才需要查重
  if (nextName !== current.name || nextMuscleId !== current.muscleId) {
    const duplicated = await exerciseRepository.findByMuscleAndName(nextMuscleId, nextName);
    if (duplicated && duplicated.id !== id) {
      throw ApiError.conflict(`该部位下已经有同名动作「${nextName}」了。`);
    }
  }

  const data: Prisma.ExerciseUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.muscleId !== undefined) data.muscle = { connect: { id: input.muscleId } };
  const description = normalizeOptionalText(input.description);
  if (description !== undefined) data.description = description;

  const row = await exerciseRepository.update(id, data);
  return toExerciseDto(row);
}

/**
 * 删除动作。
 * 已经被训练记录引用时不允许删除 —— 级联删除会静默抹掉历史数据，
 * 与「数据可靠性优先」冲突。想清理就改名，或者先删掉相关训练。
 */
export async function deleteExercise(id: number): Promise<{ id: number }> {
  const current = await exerciseRepository.findById(id);
  if (!current) {
    throw ApiError.notFound('找不到这个动作，可能已被删除。');
  }

  const usage = await exerciseRepository.countUsage(id);
  if (usage > 0) {
    throw ApiError.conflict(
      `该动作已被 ${usage} 条训练记录使用，删除会丢失历史数据。可以改成别的名字继续用，或先清理相关训练。`,
    );
  }

  return exerciseRepository.remove(id);
}
