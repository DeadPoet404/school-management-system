import { Request, Response, NextFunction } from 'express';
import { FilterXSS } from 'xss';

const sanitizer = new FilterXSS({
  stripIgnoreTag: true,
  stripIgnoreTagBody: true,
});

/**
 * Recursively sanitizes all string values in an object.
 * Strips any HTML tags to prevent XSS attacks.
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizer.process(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

/**
 * XSS sanitization middleware.
 * Strips HTML from all string inputs in body, query, and params.
 * Must be placed BEFORE validation middleware so Zod receives clean data.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as any;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as any;
  }
  next();
}
