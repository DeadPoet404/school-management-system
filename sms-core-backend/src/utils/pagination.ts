export interface PaginationQuery {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Parses page/limit from Express req.query with safe defaults and bounds.
 * - page: minimum 1, default 1
 * - limit: minimum 1, maximum 100, default 20
 */
export function parsePaginationQuery(query: { [key: string]: unknown }): PaginationQuery {
  const page = Math.max(1, parseInt(String(query.page ?? ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? ''), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Wraps a data slice with pagination metadata.
 */
export function buildPaginationResponse<T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    success: true,
    data: items,
    pagination: { page, limit, totalItems, totalPages },
  };
}
