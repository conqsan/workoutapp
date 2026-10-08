/**
 * 业务错误。抛出后由全局 errorHandler 统一转换成标准 API 错误响应。
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = '请求参数有误，请检查后重试。', details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = '登录状态已失效，请重新登录。'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static notFound(message = '找不到对应的数据。'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = '数据已存在，请勿重复提交。'): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }

  static unprocessable(message = '数据校验未通过。', details?: unknown): ApiError {
    return new ApiError(422, 'UNPROCESSABLE_ENTITY', message, details);
  }

  static internal(message = '服务器开小差了，请稍后重试。'): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
