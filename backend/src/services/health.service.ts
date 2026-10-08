import { getPrisma } from '../config/prisma';
import { env } from '../config/env';
import { SERVICE_NAME, SERVICE_VERSION } from '../utils/constants';
import type { HealthPayload } from '../types/api';

const NOT_GENERATED_HINTS = [
  'did not initialize yet',
  'Please run "prisma generate"',
  'no models defined',
];

function toDatabaseMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (NOT_GENERATED_HINTS.some((hint) => raw.toLowerCase().includes(hint.toLowerCase()))) {
    return 'Prisma Client 尚未生成：Phase 2 定义数据模型后执行 npm run db:push 即可自动生成。';
  }

  // 不把原始数据库错误直接抛给前端，只保留足够定位问题的信息
  return `数据库暂不可用：${raw.split('\n')[0] ?? raw}`;
}

async function checkDatabase(): Promise<HealthPayload['database']> {
  if (!env.DATABASE_URL) {
    return {
      configured: false,
      initialized: false,
      message: 'DATABASE_URL 未配置，请参考 backend/.env.example。',
    };
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { configured: true, initialized: true };
  } catch (error) {
    return {
      configured: true,
      initialized: false,
      message: toDatabaseMessage(error),
    };
  }
}

export async function getHealthStatus(): Promise<HealthPayload> {
  const database = await checkDatabase();

  return {
    status: database.initialized ? 'ok' : 'degraded',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database,
  };
}
