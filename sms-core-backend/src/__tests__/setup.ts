// Set required env vars before any module loads Prisma client or env validation
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-at-least-sixteen-characters';
