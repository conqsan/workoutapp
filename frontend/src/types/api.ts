/** 后端统一成功响应。 */
export interface ApiSuccess<TData> {
  success: true;
  data: TData;
}

/** 后端统一失败响应。 */
export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

/** GET /api/health 的响应数据。 */
export interface HealthPayload {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    configured: boolean;
    initialized: boolean;
    message?: string;
  };
}

export type ConnectionState = 'loading' | 'online' | 'offline';
