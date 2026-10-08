import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/services/apiClient';
import { healthService } from '@/services/healthService';
import type { ConnectionState, HealthPayload } from '@/types/api';

export interface UseBackendHealthResult {
  state: ConnectionState;
  data: HealthPayload | null;
  errorMessage: string | null;
  refresh: () => void;
}

export function useBackendHealth(): UseBackendHealthResult {
  const [state, setState] = useState<ConnectionState>('loading');
  const [data, setData] = useState<HealthPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const run = useCallback(async (): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState('loading');
    setErrorMessage(null);

    try {
      const payload = await healthService.check(controller.signal);
      if (!mountedRef.current) return;
      setData(payload);
      setState('online');
    } catch (error) {
      if (!mountedRef.current) return;
      setData(null);
      setState('offline');
      setErrorMessage(
        error instanceof ApiClientError ? error.message : '无法连接服务器，请稍后重试。',
      );
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void run();

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [run]);

  const refresh = useCallback((): void => {
    void run();
  }, [run]);

  return { state, data, errorMessage, refresh };
}
