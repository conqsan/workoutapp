import type { ApiResponse } from '@/types/api';

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 10_000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiClientErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
}

/**
 * 前端统一错误类型。
 * message 一定是能直接展示给用户的中文提示，绝不透传 Internal Server Error。
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: ApiClientErrorOptions = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status ?? 0;
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.details = options.details;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

export interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function defaultMessageForStatus(status: number): string {
  if (status === 400) return '请求参数有误，请检查后重试。';
  if (status === 404) return '找不到对应的数据。';
  if (status === 409) return '数据已存在，请勿重复提交。';
  if (status >= 500) return '服务器开小差了，请稍后重试。';
  return '请求失败，请稍后重试。';
}

function parseBody(text: string): unknown {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toApiClientError(status: number, payload: unknown): ApiClientError {
  const failure = payload as Partial<ApiResponse<never>> | null;
  const errorInfo = failure && failure.success === false ? failure.error : undefined;

  return new ApiClientError(errorInfo?.message ?? defaultMessageForStatus(status), {
    status,
    code: errorInfo?.code ?? `HTTP_${status}`,
    details: errorInfo?.details,
  });
}

async function request<TData>(
  path: string,
  method: HttpMethod,
  options: RequestOptions = {},
): Promise<TData> {
  const { body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = (): void => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    const payload = parseBody(await response.text());

    if (!response.ok) {
      throw toApiClientError(response.status, payload);
    }

    const success = payload as ApiResponse<TData> | null;
    if (!success || success.success !== true) {
      throw new ApiClientError('服务器返回了无法识别的数据格式。', {
        status: response.status,
        code: 'INVALID_RESPONSE',
      });
    }

    return success.data;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError('请求超时，请检查网络后重试。', { code: 'TIMEOUT' });
    }

    throw new ApiClientError('无法连接服务器，请检查网络后重试。', { code: 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

/**
 * 与 UI 解耦的 API 客户端。
 * 页面/组件只调用 service 层，不直接拼 URL。
 */
export const apiClient = {
  get: <TData>(path: string, options?: RequestOptions): Promise<TData> =>
    request<TData>(path, 'GET', options),
  post: <TData>(path: string, options?: RequestOptions): Promise<TData> =>
    request<TData>(path, 'POST', options),
  put: <TData>(path: string, options?: RequestOptions): Promise<TData> =>
    request<TData>(path, 'PUT', options),
  patch: <TData>(path: string, options?: RequestOptions): Promise<TData> =>
    request<TData>(path, 'PATCH', options),
  delete: <TData>(path: string, options?: RequestOptions): Promise<TData> =>
    request<TData>(path, 'DELETE', options),
};
