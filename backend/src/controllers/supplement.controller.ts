import type { FastifyReply, FastifyRequest } from 'fastify';
import * as supplementService from '../services/supplement.service';
import { idParamSchema } from '../schemas/common.schema';
import { createSupplementSchema, updateSupplementSchema } from '../schemas/supplement.schema';
import type { ApiSuccessBody, SupplementDto } from '../types/api';

export async function list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const supplements = await supplementService.listSupplements();

  await reply.code(200).send({
    success: true,
    data: supplements,
  } satisfies ApiSuccessBody<SupplementDto[]>);
}

export async function create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = createSupplementSchema.parse(request.body);
  const supplement = await supplementService.createSupplement(input);

  await reply.code(201).send({
    success: true,
    data: supplement,
  } satisfies ApiSuccessBody<SupplementDto>);
}

export async function update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = updateSupplementSchema.parse(request.body);
  const supplement = await supplementService.updateSupplement(id, input);

  await reply.code(200).send({
    success: true,
    data: supplement,
  } satisfies ApiSuccessBody<SupplementDto>);
}

export async function remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const deleted = await supplementService.deleteSupplement(id);

  await reply.code(200).send({
    success: true,
    data: deleted,
  } satisfies ApiSuccessBody<{ id: number }>);
}
