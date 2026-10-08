import type { Prisma, Supplement } from '@prisma/client';
import { getPrisma } from '../config/prisma';

export function findAll(): Promise<Supplement[]> {
  // 默认补剂排在前面，其次按名称
  return getPrisma().supplement.findMany({ orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] });
}

export function findById(id: number): Promise<Supplement | null> {
  return getPrisma().supplement.findUnique({ where: { id } });
}

export function findByName(name: string): Promise<{ id: number } | null> {
  return getPrisma().supplement.findUnique({ where: { name }, select: { id: true } });
}

export function create(data: {
  name: string;
  unit: string;
  units: string;
  isDefault: boolean;
}): Promise<Supplement> {
  return getPrisma().supplement.create({ data });
}

export function update(id: number, data: Prisma.SupplementUpdateInput): Promise<Supplement> {
  return getPrisma().supplement.update({ where: { id }, data });
}

export function remove(id: number): Promise<{ id: number }> {
  return getPrisma().supplement.delete({ where: { id }, select: { id: true } });
}

/** 这个补剂被多少条使用记录引用了（用于阻止会丢历史数据的删除） */
export function countUsage(id: number): Promise<number> {
  return getPrisma().supplementRecord.count({ where: { supplementId: id } });
}
