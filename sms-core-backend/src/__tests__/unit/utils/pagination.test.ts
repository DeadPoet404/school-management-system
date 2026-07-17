import { describe, it, expect } from 'vitest';
import { parsePaginationQuery, buildPaginationResponse } from '@/utils/pagination';

describe('parsePaginationQuery', () => {
  it('should return defaults for empty query', () => {
    expect(parsePaginationQuery({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('should parse page and limit', () => {
    expect(parsePaginationQuery({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50, skip: 100 });
  });

  it('should enforce minimum page of 1', () => {
    expect(parsePaginationQuery({ page: '0' }).page).toBe(1);
    expect(parsePaginationQuery({ page: '-5' }).page).toBe(1);
  });

  it('should treat limit 0 as unspecified (falls to default 20)', () => {
    // parseInt('0') = 0, which is falsy, so 0 || 20 = 20
    expect(parsePaginationQuery({ limit: '0' }).limit).toBe(20);
  });

  it('should clamp negative limit to minimum of 1', () => {
    // parseInt('-10') = -10, which is truthy, so Math.max(1, -10) = 1
    expect(parsePaginationQuery({ limit: '-10' }).limit).toBe(1);
  });

  it('should enforce maximum limit of 100', () => {
    expect(parsePaginationQuery({ limit: '500' }).limit).toBe(100);
  });

  it('should handle non-numeric input with defaults', () => {
    expect(parsePaginationQuery({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('should calculate correct skip', () => {
    expect(parsePaginationQuery({ page: '5', limit: '10' }).skip).toBe(40);
  });
});

describe('buildPaginationResponse', () => {
  it('should wrap data with pagination metadata', () => {
    const result = buildPaginationResponse([{ id: 1 }], 50, 1, 10);
    expect(result).toEqual({
      success: true,
      data: [{ id: 1 }],
      pagination: { page: 1, limit: 10, totalItems: 50, totalPages: 5 },
    });
  });

  it('should round up totalPages with remainder', () => {
    expect(buildPaginationResponse([], 45, 1, 10).pagination.totalPages).toBe(5);
  });

  it('should handle zero total items', () => {
    expect(buildPaginationResponse([], 0, 1, 20).pagination.totalPages).toBe(0);
  });
});
