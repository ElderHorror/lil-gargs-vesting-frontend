/**
 * Enhanced API Client with retry logic, timeouts, caching, and error handling
 */

interface RequestOptions extends RequestInit {
  json?: unknown;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cache?: 'no-store' | 'force-cache' | 'reload';
  cacheKey?: string;
  cacheDuration?: number; // in milliseconds
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  duration: number;
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface RequestMetrics {
  url: string;
  method: string;
  duration: number;
  status: number;
  retries: number;
  cached: boolean;
  timestamp: number;
}

const API_BASE = "https://lil-gargs-vesting-backend.onrender.com/api";

// In-memory cache
const cache = new Map<string, CacheEntry<unknown>>();

// Request metrics for monitoring
const metrics: RequestMetrics[] = [];
const MAX_METRICS = 100;

// Default retry config
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Check if a response status is retryable
 */
function isRetryableStatus(status: number): boolean {
  // Retry on server errors (5xx) and specific client errors
  return status >= 500 || status === 408 || status === 429;
}

/**
 * Parse error response
 */
async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") {
      return data.error;
    }
    if (typeof data?.message === "string") {
      return data.message;
    }
    if (data?.validation || data?.suggestions) {
      return JSON.stringify(data);
    }
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`;
}

/**
 * Get cached data if available and not expired
 */
function getCachedData<T>(cacheKey: string): T | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.duration) {
    cache.delete(cacheKey);
    return null;
  }

  return entry.data as T;
}

/**
 * Set cache data
 */
function setCacheData<T>(cacheKey: string, data: T, duration: number): void {
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    duration,
  });
}

/**
 * Record request metrics
 */
function recordMetric(metric: RequestMetrics): void {
  metrics.push(metric);
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

/**
 * Main request function with retry logic and timeout
 */
async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    json,
    headers,
    timeout = 30000,
    retries = DEFAULT_RETRY_CONFIG.maxRetries,
    retryDelay = DEFAULT_RETRY_CONFIG.initialDelay,
    cache: cacheMode = "no-store",
    cacheKey,
    cacheDuration = 5 * 60 * 1000, // 5 minutes default
    ...rest
  } = options;

  const method = (rest.method as string) || "GET";
  const url = `${API_BASE}${path}`;
  const startTime = Date.now();
  let lastError: Error | null = null;
  let attempt = 0;

  // Check cache first
  if (cacheMode !== "reload" && cacheKey) {
    const cachedData = getCachedData<T>(cacheKey);
    if (cachedData) {
      recordMetric({
        url,
        method,
        duration: 0,
        status: 200,
        retries: 0,
        cached: true,
        timestamp: Date.now(),
      });
      return cachedData;
    }
  }

  // Retry loop
  while (attempt <= retries) {
    try {
      const reqHeaders = new Headers(headers ?? undefined);
      if (!reqHeaders.has("Accept")) {
        reqHeaders.set("Accept", "application/json");
      }

      let body: BodyInit | undefined;
      if (json !== undefined) {
        reqHeaders.set("Content-Type", "application/json");
        body = JSON.stringify(json);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, {
          ...rest,
          method,
          headers: reqHeaders,
          body,
          signal: controller.signal,
          cache: cacheMode,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const message = await parseError(res);

          // Check if retryable
          if (isRetryableStatus(res.status) && attempt < retries) {
            attempt++;
            const delay = calculateBackoffDelay(attempt, {
              maxRetries: retries,
              initialDelay: retryDelay,
              maxDelay: DEFAULT_RETRY_CONFIG.maxDelay,
              backoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier,
            });

            console.warn(
              `[API] Request failed with ${res.status}. Retrying in ${delay}ms (attempt ${attempt}/${retries})`,
              { url, path }
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          throw new Error(message);
        }

        if (res.status === 204) {
          const result = undefined as T;
          recordMetric({
            url,
            method,
            duration: Date.now() - startTime,
            status: res.status,
            retries: attempt,
            cached: false,
            timestamp: Date.now(),
          });
          return result;
        }

        const data = (await res.json()) as T;

        // Cache successful response
        if (cacheMode !== "no-store" && cacheKey) {
          setCacheData(cacheKey, data, cacheDuration);
        }

        recordMetric({
          url,
          method,
          duration: Date.now() - startTime,
          status: res.status,
          retries: attempt,
          cached: false,
          timestamp: Date.now(),
        });

        return data;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if timeout
      if (lastError.name === "AbortError") {
        lastError = new Error(
          `Request timeout after ${timeout}ms. The server may be slow or unresponsive.`
        );
      }

      // Retry on timeout or network errors
      if (
        (lastError.name === "AbortError" || lastError.message.includes("timeout")) &&
        attempt < retries
      ) {
        attempt++;
        const delay = calculateBackoffDelay(attempt, {
          maxRetries: retries,
          initialDelay: retryDelay,
          maxDelay: DEFAULT_RETRY_CONFIG.maxDelay,
          backoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier,
        });

        console.warn(
          `[API] Request timeout/error. Retrying in ${delay}ms (attempt ${attempt}/${retries})`,
          { url, path, error: lastError.message }
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable error or max retries reached
      recordMetric({
        url,
        method,
        duration: Date.now() - startTime,
        status: 0,
        retries: attempt,
        cached: false,
        timestamp: Date.now(),
      });

      throw lastError;
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error("Request failed after all retries");
}

/**
 * Clear cache
 */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }

  const regex = new RegExp(pattern);
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      duration: entry.duration,
      expired: Date.now() - entry.timestamp > entry.duration,
    })),
  };
}

/**
 * Get request metrics
 */
export function getMetrics() {
  return {
    total: metrics.length,
    averageDuration: metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      : 0,
    cached: metrics.filter((m) => m.cached).length,
    failed: metrics.filter((m) => m.status === 0 || m.status >= 400).length,
    recent: metrics.slice(-10),
  };
}

/**
 * Public API
 */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "GET",
    }),

  post: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "POST",
      json,
    }),

  put: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PUT",
      json,
    }),

  patch: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
      json,
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "DELETE",
    }),

  // Utility methods
  clearCache,
  getCacheStats,
  getMetrics,
};
