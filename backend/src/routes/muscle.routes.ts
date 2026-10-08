import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/muscle.controller';

export async function muscleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/muscles', controller.list);
}
