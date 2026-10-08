import type { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { normalizeOptionalText } from '../utils/text';
import { toSupplementDto } from '../utils/dto';
import * as supplementRecordRepository from '../repositories/supplementRecord.repository';
import * as supplementRepository from '../repositories/supplement.repository';
import type { RecordWithSupplement } from '../repositories/supplementRecord.repository';
import type {
  CreateSupplementRecordInput,
  ListSupplementRecordsQuery,
  UpdateSupplementRecordInput,
} from '../schemas/supplementRecord.schema';
import type { SupplementRecordDto } from '../types/api';

function toRecordDto(row: RecordWithSupplement): SupplementRecordDto {
  return {
    id: row.id,
    supplementId: row.supplementId,
    supplement: toSupplementDto(row.supplement),
    date: row.date,
    amount: row.amount,
    unit: row.unit,
    consumptionTime: row.consumptionTime,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecords(
  filter: ListSupplementRecordsQuery,
): Promise<SupplementRecordDto[]> {
  const rows = await supplementRecordRepository.findAll(filter);
  return rows.map(toRecordDto);
}

async function requireSupplement(id: number) {
  const supplement = await supplementRepository.findById(id);
  if (!supplement) {
    throw ApiError.badRequest('补剂不存在，请刷新后重试。');
  }
  return supplement;
}

export async function createRecord(
  input: CreateSupplementRecordInput,
  today: string,
): Promise<SupplementRecordDto> {
  const supplement = await requireSupplement(input.supplementId);

  const row = await supplementRecordRepository.create({
    supplementId: input.supplementId,
    date: input.date ?? today,
    amount: input.amount,
    // 没写单位就跟随补剂自身的单位，避免出现没单位的记录
    unit: input.unit ?? supplement.unit,
    consumptionTime: normalizeOptionalText(input.consumptionTime) ?? null,
    note: normalizeOptionalText(input.note) ?? null,
  });

  return toRecordDto(row);
}

export async function updateRecord(
  id: number,
  input: UpdateSupplementRecordInput,
): Promise<SupplementRecordDto> {
  const current = await supplementRecordRepository.findById(id);
  if (!current) {
    throw ApiError.notFound('找不到这条补剂记录，可能已被删除。');
  }

  if (input.supplementId !== undefined && input.supplementId !== current.supplementId) {
    await requireSupplement(input.supplementId);
  }

  const data: Prisma.SupplementRecordUpdateInput = {};
  if (input.supplementId !== undefined) data.supplement = { connect: { id: input.supplementId } };
  if (input.date !== undefined) data.date = input.date;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.unit !== undefined) data.unit = input.unit;
  const consumptionTime = normalizeOptionalText(input.consumptionTime);
  if (consumptionTime !== undefined) data.consumptionTime = consumptionTime;
  const note = normalizeOptionalText(input.note);
  if (note !== undefined) data.note = note;

  return toRecordDto(await supplementRecordRepository.update(id, data));
}

export async function deleteRecord(id: number): Promise<{ id: number }> {
  const current = await supplementRecordRepository.findById(id);
  if (!current) {
    throw ApiError.notFound('找不到这条补剂记录，可能已被删除。');
  }
  return supplementRecordRepository.remove(id);
}
