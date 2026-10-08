import * as muscleRepository from '../repositories/muscle.repository';
import { toMuscleDto } from '../utils/dto';
import type { MuscleDto } from '../types/api';

export async function listMuscles(): Promise<MuscleDto[]> {
  const rows = await muscleRepository.findAll();
  return rows.map(toMuscleDto);
}
