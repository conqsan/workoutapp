import type { Prisma, Supplement } from '@prisma/client';
import { getPrisma } from '../config/prisma';

type RecordWithSupplement = Prisma.SupplementRecordGetPayload<{
  include: typeof SUPPLEMENT_INCLUDE;
}>;

const SUPPLEMENT_INCLUDE = { supplement: true } satisfies Prisma.SupplementRecordInclude;

export function findAll(filter: {
  date?: string;
  supplementId?: number;
}): Promise<RecordWithSupplement[]> {
  const where: Prisma.SupplementRecordWhereInput = {};
  if (filter.date !== undefined) where.date = filter.date;
  if (filter.supplementId !== undefined) where.supplementId = filter.supplementId;

  return getPrisma().supplementRecord.findMany({
    where,
    include: SUPPLEMENT_INCLUDE,
    // 最近的日期在前；同一天按录入顺序
    orderBy: [{ date: 'desc' }, { id: 'asc' }],
  });
}

export function findById(id: number): Promise<RecordWithSupplement | null> {
  return getPrisma().supplementRecord.findUnique({ where: { id }, include: SUPPLEMENT_INCLUDE });
}

export function create(data: {
  supplementId: number;
  date: string;
  amount: number;
  unit: string;
  consumptionTime: string | null;
  note: string | null;
}): Promise<RecordWithSupplement> {
  return getPrisma().supplementRecord.create({ data, include: SUPPLEMENT_INCLUDE });
}

export function update(
  id: number,
  data: Prisma.SupplementRecordUpdateInput,
): Promise<RecordWithSupplement> {
  return getPrisma().supplementRecord.update({ where: { id }, data, include: SUPPLEMENT_INCLUDE });
}

export function remove(id: number): Promise<{ id: number }> {
  return getPrisma().supplementRecord.delete({ where: { id }, select: { id: true } });
}

export type { RecordWithSupplement, Supplement };
