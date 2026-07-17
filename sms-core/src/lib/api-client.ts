const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface ApiClientOptions extends RequestInit {
  params?: Record<string, string>;
}

export class ApiClientError extends Error {
  statusCode: number;
  data: any;

  constructor(statusCode: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sms_token');
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('sms_token');
  localStorage.removeItem('sms_user');
  window.location.href = '/login';
}

export async function apiClient<T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { params, headers: customHeaders, ...fetchOptions } = options;

  let url = `${API_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
      throw new ApiClientError(401, 'Session expired. Please log in again.');
    }

    throw new ApiClientError(
      response.status,
      data?.message || `Request failed with status ${response.status}`,
      data
    );
  }

  return data as T;
}
