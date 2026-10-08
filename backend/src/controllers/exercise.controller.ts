import type { FastifyReply, FastifyRequest } from 'fastify';
import * as exerciseService from '../services/exercise.service';
import * as workoutService from '../services/workout.service';
import { idParamSchema } from '../schemas/common.schema';
import {
  createExerciseSchema,
  listExercisesQuerySchema,
  updateExerciseSchema,
} from '../schemas/exercise.schema';
import type { ApiSuccessBody, ExerciseDto, LastWorkoutDto } from '../types/api';

export async function list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { muscleId } = listExercisesQuerySchema.parse(request.query);
  const exercises = await exerciseService.listExercises(muscleId);

  await reply.code(200).send({
    success: true,
    data: exercises,
  } satisfies ApiSuccessBody<ExerciseDto[]>);
}

export async function detail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const exercise = await exerciseService.getExercise(id);

  await reply.code(200).send({
    success: true,
    data: exercise,
  } satisfies ApiSuccessBody<ExerciseDto>);
}

export async function create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = createExerciseSchema.parse(request.body);
  const exercise = await exerciseService.createExercise(input);

  await reply.code(201).send({
    success: true,
    data: exercise,
  } satisfies ApiSuccessBody<ExerciseDto>);
}

export async function update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = updateExerciseSchema.parse(request.body);
  const exercise = await exerciseService.updateExercise(id, input);

  await reply.code(200).send({
    success: true,
    data: exercise,
  } satisfies ApiSuccessBody<ExerciseDto>);
}

export async function remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const deleted = await exerciseService.deleteExercise(id);

  await reply.code(200).send({
    success: true,
    data: deleted,
  } satisfies ApiSuccessBody<{ id: number }>);
}

/** GET /api/exercises/:id/last-workout —— 上一次该动作的训练数据，没有历史时返回 null */
export async function lastWorkout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const lastWorkout = await workoutService.getLastWorkout(id);

  await reply.code(200).send({
    success: true,
    data: lastWorkout,
  } satisfies ApiSuccessBody<LastWorkoutDto | null>);
}
