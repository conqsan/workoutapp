import { PrismaClient } from '@prisma/client';
import { isDevelopment } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __fitlogPrisma__: PrismaClient | undefined;
}

let cached: PrismaClient | undefined;

/**
 * 惰性获取单例 PrismaClient。
 *
 * 为什么是惰性而不是模块级 `new PrismaClient()`：
 *  1. Phase 1 还没有定义数据模型，Prisma Client 尚未生成。此时构造会直接抛错，
 *     模块级构造会让整个后端无法启动 —— 而 Phase 1 只要求「后端能启动 + 前后端能通信」。
 *  2. 开发模式下把实例挂到 globalThis，避免 tsx watch 热重载时反复创建连接。
 *
 * Phase 2 定义模型并执行 `npm run db:push` 之后，这里会自动返回可用实例。
 */
export function getPrisma(): PrismaClient {
  if (cached) {
    return cached;
  }

  const instance = globalThis.__fitlogPrisma__ ?? new PrismaClient();
  cached = instance;

  if (isDevelopment) {
    globalThis.__fitlogPrisma__ = instance;
  }

  return instance;
}

export async function disconnectDatabase(): Promise<void> {
  const instance = cached ?? globalThis.__fitlogPrisma__;
  if (instance) {
    await instance.$disconnect();
  }
}
