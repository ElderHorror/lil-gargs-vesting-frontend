/**
 * Custom hook for handling API requests with error handling, retries, and loading states
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';

export interface UseApiRequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cacheKey?: string;
  cacheDuration?: number;
  autoFetch?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: <T>(data: T) => void;
}

export interface UseApiRequestState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retrying: boolean;
  retryCount: number;
  isStale: boolean;
  fetch: () => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for GET requests
 */
export function useApiGet<T>(
  path: string,
  options: UseApiRequestOptions = {}
): UseApiRequestState<T> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    cacheKey,
    cacheDuration = 5 * 60 * 1000,
    autoFetch = true,
    onError,
    onSuccess,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const isMountedRef = useRef(true);

  const fetch = useCallback(async (): Promise<T | null> => {
    if (!isMountedRef.current) return null;

    setLoading(true);
    setError(null);
    setIsStale(false);

    try {
      const result = await apiClient.get<T>(path, {
        timeout,
        retries,
        retryDelay,
        cacheKey,
        cacheDuration,
      });

      if (!isMountedRef.current) return null;

      setData(result);
      setRetryCount(0);
      onSuccess?.(result);
      return result;
    } catch (err) {
      if (!isMountedRef.current) return null;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      return null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [path, timeout, retries, retryDelay, cacheKey, cacheDuration, onError, onSuccess]);

  const retry = useCallback(async (): Promise<T | null> => {
    if (!isMountedRef.current) return null;

    setRetrying(true);
    setRetryCount((prev) => prev + 1);

    try {
      const result = await fetch();
      if (isMountedRef.current) {
        setRetrying(false);
      }
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setRetrying(false);
      }
      throw err;
    }
  }, [fetch]);

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setData(null);
      setError(null);
      setRetryCount(0);
      setIsStale(false);
    }
  }, []);

  // Mark as stale after cache duration
  useEffect(() => {
    if (!cacheKey || !data) return;

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsStale(true);
      }
    }, cacheDuration);

    return () => clearTimeout(timer);
  }, [data, cacheKey, cacheDuration]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      void fetch();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoFetch, fetch]);

  return {
    data,
    loading,
    error,
    retrying,
    retryCount,
    isStale,
    fetch,
    retry,
    reset,
  };
}

/**
 * Hook for POST/PUT/PATCH requests
 */
export function useApiMutation<T, P = unknown>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: UseApiRequestOptions = {}
) {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    onError,
    onSuccess,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const mutate = useCallback(
    async (payload?: P): Promise<T | null> => {
      if (!isMountedRef.current) return null;

      setLoading(true);
      setError(null);

      try {
        let result: T;

        if (method === 'DELETE') {
          result = await apiClient.delete<T>(path, {
            timeout,
            retries,
            retryDelay,
          });
        } else if (method === 'POST') {
          result = await apiClient.post<T>(path, payload, {
            timeout,
            retries,
            retryDelay,
          });
        } else if (method === 'PUT') {
          result = await apiClient.put<T>(path, payload, {
            timeout,
            retries,
            retryDelay,
          });
        } else {
          result = await apiClient.patch<T>(path, payload, {
            timeout,
            retries,
            retryDelay,
          });
        }

        if (!isMountedRef.current) return null;

        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        if (!isMountedRef.current) return null;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return null;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [method, path, timeout, retries, retryDelay, onError, onSuccess]
  );

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setData(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    mutate,
    reset,
  };
}
