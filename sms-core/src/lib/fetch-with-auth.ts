const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// ── Error class (migrated from legacy api-client.ts) ──
export class ApiClientError extends Error {
  statusCode: number;
  data: unknown;

  constructor(statusCode: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

// ── Refresh promise lock: prevents concurrent refresh attempts ──
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Authenticated fetch wrapper.
 *
 * Reads access_token from httpOnly cookie (sent via credentials: 'include').
 * No localStorage reads or Authorization headers.
 *
 * Auto-refresh: On 401, attempts to refresh the access token via the
 * refresh_token cookie. If successful, retries the original request.
 * If refresh fails, returns the 401 response — the caller or
 * ProtectedRoute/middleware handles routing.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
    credentials: 'include',
  });

  // ── Auto-refresh on 401 ──
  if (response.status === 401) {
    const refreshed = await attemptRefresh();

    if (refreshed) {
      // Retry original request with new cookies
      return fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string>),
        },
        credentials: 'include',
      });
    }

    // Refresh failed — return 401 response, do NOT redirect.
    // The middleware guards route access; ProtectedRoute and
    // auth-context handle session state. Redirecting here
    // causes infinite loops on /login when no cookie exists.
    return response;
  }

  return response;
}
