import { apiClient } from '@/services/apiClient';
import type { HealthPayload } from '@/types/api';

export const healthService = {
  /** 探测后端是否可用（Phase 1 用于验证前后端连通性）。 */
  check: (signal?: AbortSignal): Promise<HealthPayload> =>
    apiClient.get<HealthPayload>('/health', { signal, timeoutMs: 5_000 }),
};
