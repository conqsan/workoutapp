import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/workout.controller';

export async function workoutRoutes(app: FastifyInstance): Promise<void> {
  // 训练
  app.get('/workouts/active', controller.active);
  app.post('/workouts', controller.start);
  app.get('/workouts/:id', controller.detail);
  app.put('/workouts/:id', controller.update);
  app.delete('/workouts/:id', controller.remove);
  app.post('/workouts/:id/complete', controller.complete);

  // 训练里的动作
  app.post('/workouts/:id/exercises', controller.addExercise);
  app.put('/workouts/:id/exercises/reorder', controller.reorderExercises);
  app.put('/workout-exercises/:id', controller.updateExercise);
  app.delete('/workout-exercises/:id', controller.removeExercise);

  // 训练组
  app.post('/workout-exercises/:id/sets', controller.addSet);
  app.put('/sets/:id', controller.updateSet);
  app.delete('/sets/:id', controller.removeSet);
}
