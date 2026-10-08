import type { FastifyInstance } from 'fastify';
import { getHealth } from '../controllers/health.controller';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', getHealth);
}
