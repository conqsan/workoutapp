import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { env } from './config/env';
import { disconnectDatabase } from './config/prisma';
import { logger } from './utils/logger';
import { API_PREFIX } from './utils/constants';

async function shutdown(app: FastifyInstance, signal: string): Promise<void> {
  logger.info(`收到 ${signal}，正在关闭服务...`);
  try {
    await app.close();
    await disconnectDatabase();
    logger.info('服务已安全退出。');
    process.exit(0);
  } catch (error) {
    logger.error('关闭服务时出错', error);
    process.exit(1);
  }
}

async function start(): Promise<void> {
  try {
    const app = await buildApp();
    await app.listen({ port: env.PORT, host: env.HOST });

    logger.info(`健康检查：http://localhost:${env.PORT}${API_PREFIX}/health`);
    logger.info(`开发接口根路径：http://localhost:${env.PORT}${API_PREFIX}`);

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => {
        void shutdown(app, signal);
      });
    }
  } catch (error) {
    logger.error('后端启动失败', error);
    process.exit(1);
  }
}

void start();
