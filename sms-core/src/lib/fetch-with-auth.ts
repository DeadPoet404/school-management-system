const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sms_token');
}

/**
 * Drop-in replacement for raw fetch() that adds:
 * 1. Base API URL (no more hardcoded URLs)
 * 2. Authorization header from localStorage
 * 3. JSON content-type header
 *
 * Returns a raw Response object so existing response.json() calls still work.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

  return fetch(fullUrl, {
    ...options,
    headers,
  });
}
