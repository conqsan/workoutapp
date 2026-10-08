import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/supplement.controller';

export async function supplementRoutes(app: FastifyInstance): Promise<void> {
  app.get('/supplements', controller.list);
  app.post('/supplements', controller.create);
  app.put('/supplements/:id', controller.update);
  app.delete('/supplements/:id', controller.remove);
}
