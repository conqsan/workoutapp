import 'dotenv/config';
import { z } from 'zod';

/**
 * 环境变量集中在启动时校验。
 * 任何缺失/非法的配置都会让进程直接退出，避免带着坏配置跑起来。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 未配置（请参考 backend/.env.example）'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`[FitLog] 环境变量校验失败：\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** CORS 允许来源：支持逗号分隔的多来源，或 `*` 表示全部允许。 */
export function resolveCorsOrigins(): true | string[] {
  if (env.CORS_ORIGIN.trim() === '*') {
    return true;
  }
  return env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
