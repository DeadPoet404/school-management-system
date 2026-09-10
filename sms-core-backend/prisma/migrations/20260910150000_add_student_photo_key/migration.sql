-- Student profile photos live in private object storage.
-- PostgreSQL stores only the optional opaque storage object key.
-- This nullable addition preserves every existing student record.
ALTER TABLE "Student" ADD COLUMN "photoKey" TEXT;
