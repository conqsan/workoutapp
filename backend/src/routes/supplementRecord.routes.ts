import type { FastifyInstance } from 'fastify';
import * as controller from '../controllers/supplementRecord.controller';

export async function supplementRecordRoutes(app: FastifyInstance): Promise<void> {
  app.get('/supplement-records', controller.list);
  app.post('/supplement-records', controller.create);
  app.put('/supplement-records/:id', controller.update);
  app.delete('/supplement-records/:id', controller.remove);
}
