import type { Muscle, Supplement } from '@prisma/client';
import type { ExerciseWithMuscle } from '../repositories/exercise.repository';
import type { ExerciseDto, MuscleDto, SupplementDto } from '../types/api';
import { parseUnits } from './supplementUnits';

/** 各 service 共用的 DTO 映射，保证同一个实体在任何接口里形状一致 */

export function toMuscleDto(
  row: Muscle | { id: number; name: string; sortOrder: number },
): MuscleDto {
  return { id: row.id, name: row.name, sortOrder: row.sortOrder };
}

export function toExerciseDto(row: ExerciseWithMuscle): ExerciseDto {
  return {
    id: row.id,
    name: row.name,
    muscleId: row.muscleId,
    muscle: toMuscleDto(row.muscle),
    description: row.description,
    isCustom: row.isCustom,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSupplementDto(row: Supplement): SupplementDto {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    units: parseUnits(row.units, row.unit),
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
