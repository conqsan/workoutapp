import type { Muscle } from '@prisma/client';
import { getPrisma } from '../config/prisma';

export function findAll(): Promise<Muscle[]> {
  return getPrisma().muscle.findMany({ orderBy: { sortOrder: 'asc' } });
}

export function findById(id: number): Promise<Muscle | null> {
  return getPrisma().muscle.findUnique({ where: { id } });
}
