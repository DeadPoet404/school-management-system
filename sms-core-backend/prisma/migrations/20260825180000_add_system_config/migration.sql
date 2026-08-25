-- SMS-013: Singleton system_config for school profile + first-start gate.
-- Application code always reads/writes id = 1.

CREATE TABLE "system_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "schoolName" TEXT NOT NULL,
    "schoolCode" TEXT NOT NULL,
    "motto" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GH',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "setupCompletedAt" TIMESTAMP(3),
    "setupVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- Enforce the singleton invariant at the database level: only id = 1 is legal.
ALTER TABLE "system_config"
  ADD CONSTRAINT "system_config_singleton_id_check" CHECK ("id" = 1);

CREATE UNIQUE INDEX "system_config_schoolCode_key" ON "system_config"("schoolCode");
