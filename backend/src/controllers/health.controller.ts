import type { FastifyReply, FastifyRequest } from 'fastify';
import { getHealthStatus } from '../services/health.service';
import type { ApiSuccessBody, HealthPayload } from '../types/api';

export async function getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const payload = await getHealthStatus();

  // /api/health 只表示 HTTP 服务存活，始终返回 200。
  // 存储是否就绪通过 payload.status / payload.database 表达，避免前端把
  // 「Phase 1 还没建表」误判为「后端挂了」。
  await reply.code(200).send({
    success: true,
    data: payload,
  } satisfies ApiSuccessBody<HealthPayload>);
}
