import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/exercise.controller';

export async function exerciseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/exercises', controller.list);
  app.get('/exercises/:id', controller.detail);
  app.get('/exercises/:id/last-workout', controller.lastWorkout);
  app.post('/exercises', controller.create);
  app.put('/exercises/:id', controller.update);
  app.delete('/exercises/:id', controller.remove);
}
