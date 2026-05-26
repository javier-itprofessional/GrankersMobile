import { useState, useEffect, useRef, useCallback } from 'react';

export type BackendStatus = 'online' | 'reconnecting' | 'offline';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('online');
  const failCount = useRef(0);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    if (!API_URL) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`${API_URL}/api/v1/golf-federation/`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!mounted.current) return;
      // Any sub-500 response (including 401/403) means the server is reachable
      if (res.status < 500) {
        failCount.current = 0;
        setStatus('online');
      } else {
        failCount.current++;
        setStatus(failCount.current <= 1 ? 'reconnecting' : 'offline');
      }
    } catch {
      if (!mounted.current) return;
      failCount.current++;
      setStatus(failCount.current <= 1 ? 'reconnecting' : 'offline');
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    check();
    const id = setInterval(check, 30_000);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [check]);

  return status;
}
