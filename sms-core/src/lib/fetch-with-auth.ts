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

function buildRequestHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers)
  const isFormDataBody =
    typeof FormData !== 'undefined' && options.body instanceof FormData

  if (!isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
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
  // D-06: API_URL is '/api' and this used to concatenate without a
  // separator, so a call site passing 'students' produced '/apistudents'.
  // The Next.js rewrite only matches '/api/:path*', so those requests
  // 404'd at the frontend and never reached the backend. Normalising here
  // means no call site can get it wrong.
  const path = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${path}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: buildRequestHeaders(options),
    credentials: 'include',
  });

  // ── Auto-refresh on 401 ──
  if (response.status === 401) {
    const refreshed = await attemptRefresh();

    if (refreshed) {
      // Retry original request with new cookies
      return fetch(fullUrl, {
        ...options,
        headers: buildRequestHeaders(options),
        credentials: 'include',
      });
    }

    // Refresh failed: the session is gone. Send the user to the login
    // screen so they see a real page instead of a broken one. The pathname
    // guard prevents a redirect loop on /login itself (a cold, unauthenticated
    // visit also reaches here with no refresh cookie and must not redirect).
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      const from = window.location.pathname + window.location.search;
      window.location.href = "/login?from=" + encodeURIComponent(from);
    }
    return response;
  }

  return response;
}
