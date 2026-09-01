-- Add student password lifecycle state for temporary administrator resets.
ALTER TABLE "StudentAccount"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
