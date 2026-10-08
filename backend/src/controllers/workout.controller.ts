import type { FastifyReply, FastifyRequest } from 'fastify';
import * as workoutService from '../services/workout.service';
import { idParamSchema } from '../schemas/common.schema';
import {
  addWorkoutExerciseSchema,
  createSetSchema,
  createWorkoutSchema,
  reorderWorkoutExercisesSchema,
  updateSetSchema,
  updateWorkoutExerciseSchema,
  updateWorkoutSchema,
} from '../schemas/workout.schema';
import type { ApiSuccessBody, WorkoutDto } from '../types/api';

async function send(reply: FastifyReply, data: WorkoutDto, statusCode: number): Promise<void> {
  await reply.code(statusCode).send({ success: true, data } satisfies ApiSuccessBody<WorkoutDto>);
}

/** POST /api/workouts —— 开始训练 */
export async function start(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = createWorkoutSchema.parse(request.body ?? {});
  await send(reply, await workoutService.startWorkout(input), 201);
}

/** GET /api/workouts/active —— 当前进行中的训练（没有就返回 null） */
export async function active(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const workout = await workoutService.getActiveWorkout();
  await reply.code(200).send({
    success: true,
    data: workout,
  } satisfies ApiSuccessBody<WorkoutDto | null>);
}

/** GET /api/workouts/:id */
export async function detail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  await send(reply, await workoutService.getWorkout(id), 200);
}

/** PUT /api/workouts/:id */
export async function update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = updateWorkoutSchema.parse(request.body);
  await send(reply, await workoutService.updateWorkout(id, input), 200);
}

/** DELETE /api/workouts/:id */
export async function remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const deleted = await workoutService.deleteWorkout(id);
  await reply.code(200).send({
    success: true,
    data: deleted,
  } satisfies ApiSuccessBody<{ id: number }>);
}

/** POST /api/workouts/:id/complete */
export async function complete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  await send(reply, await workoutService.completeWorkout(id), 200);
}

// ---------------------------------------------------------------- 训练里的动作

/** POST /api/workouts/:id/exercises */
export async function addExercise(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = addWorkoutExerciseSchema.parse(request.body);
  await send(reply, await workoutService.addExercise(id, input), 201);
}

/** PUT /api/workouts/:id/exercises/reorder */
export async function reorderExercises(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const { orderedIds } = reorderWorkoutExercisesSchema.parse(request.body);
  await send(reply, await workoutService.reorderExercises(id, orderedIds), 200);
}

/** PUT /api/workout-exercises/:id */
export async function updateExercise(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = updateWorkoutExerciseSchema.parse(request.body);
  await send(reply, await workoutService.updateWorkoutExercise(id, input), 200);
}

/** DELETE /api/workout-exercises/:id */
export async function removeExercise(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  await send(reply, await workoutService.deleteWorkoutExercise(id), 200);
}

// ---------------------------------------------------------------- 训练组

/** POST /api/workout-exercises/:id/sets */
export async function addSet(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = createSetSchema.parse(request.body);
  await send(reply, await workoutService.addSet(id, input), 201);
}

/** PUT /api/sets/:id */
export async function updateSet(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const input = updateSetSchema.parse(request.body);
  await send(reply, await workoutService.updateSet(id, input), 200);
}

/** DELETE /api/sets/:id */
export async function removeSet(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  await send(reply, await workoutService.deleteSet(id), 200);
}
