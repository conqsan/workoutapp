import type { FastifyReply, FastifyRequest } from 'fastify';
import * as supplementRecordService from '../services/supplementRecord.service';
import { idParamSchema } from '../schemas/common.schema';
import {
  createSupplementRecordSchema,
  listSupplementRecordsQuerySchema,
  updateSupplementRecordSchema,
} from '../schemas/supplementRecord.schema';
import { toDateKey } from '../utils/date';
import type { ApiSuccessBody, SupplementRecordDto } from '../types/api';

/** GET /api/supplement-records?date=YYYY-MM-DD */
export async function list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filter = listSupplementRecordsQuerySchema.parse(request.query);
  const records = await supplementRecordService.listRecords(filter);

  await reply.code(200).send({
    success: true,
    data: records,
  } satisfies ApiSuccessBody<SupplementRecordDto[]>);
}

/** POST /api/supplement-records */
export async function create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = createSupplementRecordSchema.parse(request.body);
  const record = await supplementRecordService.createRecord(input, toDateKey(new Date()));

  await reply.code(201).send({
    success: true,
    data: record,
  } satisfies ApiSuccessBody<SupplementRecordDto>);
}

/** PUT /api/supplement-records/:id */
export async function update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = updateSupplementRecordSchema.parse(request.body);
  const record = await supplementRecordService.updateRecord(id, input);

  await reply.code(200).send({
    success: true,
    data: record,
  } satisfies ApiSuccessBody<SupplementRecordDto>);
}

/** DELETE /api/supplement-records/:id */
export async function remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const deleted = await supplementRecordService.deleteRecord(id);

  await reply.code(200).send({
    success: true,
    data: deleted,
  } satisfies ApiSuccessBody<{ id: number }>);
}
