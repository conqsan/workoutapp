import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env, isDevelopment, resolveCorsOrigins } from './config/env';
import { registerRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isDevelopment ? { level: 'info' } : { level: 'warn' },
    disableRequestLogging: false,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: resolveCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  if (isDevelopment) {
    app.addHook('onRequest', async (request) => {
      logger.debug(`--> ${request.method} ${request.url}`);
    });
  }

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await registerRoutes(app);

  logger.info(`FitLog 后端已就绪（env=${env.NODE_ENV}）`);

  return app;
}
