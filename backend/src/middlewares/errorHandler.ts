import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { isProduction } from '../config/env';
import type { ApiErrorBody } from '../types/api';

/** 已知的 Prisma 错误码 -> 面向用户的提示。 */
const PRISMA_ERROR_MAP: Record<string, { statusCode: number; code: string; message: string }> = {
  P2002: { statusCode: 409, code: 'DUPLICATE', message: '该数据已存在，请勿重复提交。' },
  P2003: {
    statusCode: 400,
    code: 'FOREIGN_KEY_VIOLATION',
    message: '关联数据不存在，请刷新后重试。',
  },
  P2025: { statusCode: 404, code: 'NOT_FOUND', message: '找不到对应的数据，可能已被删除。' },
};

function toErrorBody(error: unknown): { statusCode: number; body: ApiErrorBody } {
  // 1) 业务错误
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }

  // 2) 请求体/查询参数校验错误
  if (error instanceof ZodError) {
    // 顶层 message 直接用第一条字段错误的文案，前端可以直接弹给用户看；
    // 完整的逐字段信息仍然放在 details 里。
    const firstIssue = error.issues[0];
    return {
      statusCode: 422,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstIssue?.message ?? '请求参数校验未通过。',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    };
  }

  // 3) Prisma 已知错误
  const prismaCode = (error as { code?: unknown })?.code;
  if (typeof prismaCode === 'string' && prismaCode in PRISMA_ERROR_MAP) {
    const mapped = PRISMA_ERROR_MAP[prismaCode];
    if (mapped) {
      return {
        statusCode: mapped.statusCode,
        body: {
          success: false,
          error: { code: mapped.code, message: mapped.message },
        },
      };
    }
  }

  // 4) Fastify 自身错误（例如 JSON 解析失败、404）
  const fastifyError = error as FastifyError;
  if (typeof fastifyError.statusCode === 'number' && fastifyError.statusCode < 500) {
    return {
      statusCode: fastifyError.statusCode,
      body: {
        success: false,
        error: {
          code: fastifyError.code ?? 'BAD_REQUEST',
          message:
            fastifyError.statusCode === 400
              ? '请求内容无法解析，请检查后重试。'
              : fastifyError.message,
        },
      },
    };
  }

  // 5) 兜底：未知错误统一 500，日志里保留堆栈，响应里不暴露实现细节
  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器开小差了，请稍后重试。',
      },
    },
  };
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const { statusCode, body } = toErrorBody(error);

  if (statusCode >= 500) {
    logger.error(`${request.method} ${request.url} -> ${statusCode}`, error);
  } else if (!isProduction) {
    logger.debug(`${request.method} ${request.url} -> ${statusCode}`, error.message);
  }

  void reply.code(statusCode).send(body);
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): void {
  void reply.code(404).send({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `接口不存在：${request.method} ${request.url}`,
    },
  } satisfies ApiErrorBody);
}
