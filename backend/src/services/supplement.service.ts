import type { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { toSupplementDto } from '../utils/dto';
import * as supplementRepository from '../repositories/supplement.repository';
import type { CreateSupplementInput, UpdateSupplementInput } from '../schemas/supplement.schema';
import type { SupplementDto } from '../types/api';

export async function listSupplements(): Promise<SupplementDto[]> {
  const rows = await supplementRepository.findAll();
  return rows.map(toSupplementDto);
}

export async function createSupplement(input: CreateSupplementInput): Promise<SupplementDto> {
  const duplicated = await supplementRepository.findByName(input.name);
  if (duplicated) {
    throw ApiError.conflict(`已经有叫「${input.name}」的补剂了。`);
  }

  const row = await supplementRepository.create({
    name: input.name,
    unit: input.unit,
    isDefault: false,
  });

  return toSupplementDto(row);
}

export async function updateSupplement(
  id: number,
  input: UpdateSupplementInput,
): Promise<SupplementDto> {
  const current = await supplementRepository.findById(id);
  if (!current) {
    throw ApiError.notFound('找不到这个补剂，可能已被删除。');
  }

  if (input.name !== undefined && input.name !== current.name) {
    const duplicated = await supplementRepository.findByName(input.name);
    if (duplicated && duplicated.id !== id) {
      throw ApiError.conflict(`已经有叫「${input.name}」的补剂了。`);
    }
  }

  const data: Prisma.SupplementUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.unit !== undefined) data.unit = input.unit;

  const row = await supplementRepository.update(id, data);
  return toSupplementDto(row);
}

/**
 * 删除补剂。
 * 已经有使用记录时不允许删除，理由同动作：不能静默抹掉历史数据。
 */
export async function deleteSupplement(id: number): Promise<{ id: number }> {
  const current = await supplementRepository.findById(id);
  if (!current) {
    throw ApiError.notFound('找不到这个补剂，可能已被删除。');
  }

  const usage = await supplementRepository.countUsage(id);
  if (usage > 0) {
    throw ApiError.conflict(
      `「${current.name}」已有 ${usage} 条使用记录，删除会丢失历史数据。建议保留。`,
    );
  }

  return supplementRepository.remove(id);
}
