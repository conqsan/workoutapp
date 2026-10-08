import type { FastifyReply, FastifyRequest } from 'fastify';
import * as muscleService from '../services/muscle.service';
import type { ApiSuccessBody, MuscleDto } from '../types/api';

export async function list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const muscles = await muscleService.listMuscles();
  await reply.code(200).send({
    success: true,
    data: muscles,
  } satisfies ApiSuccessBody<MuscleDto[]>);
}
