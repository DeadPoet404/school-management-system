-- Transport foundation: buses, offline-capable scanner devices, card tokens,
-- effective bus assignments, trips, and immutable boarding events.
CREATE TYPE "TransportTripDirection" AS ENUM ('TO_SCHOOL', 'FROM_SCHOOL');
CREATE TYPE "TransportTripStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "TransportCardStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "TransportBoardingSource" AS ENUM ('QR', 'MANUAL');
CREATE TYPE "TransportAssignmentStatus" AS ENUM ('ASSIGNED', 'UNASSIGNED');

CREATE TABLE "TransportBus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportBus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransportBus_code_key" ON "TransportBus"("code");
CREATE UNIQUE INDEX "TransportBus_registrationNumber_key" ON "TransportBus"("registrationNumber");

CREATE TABLE "TransportDevice" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "label" TEXT,
    "busId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransportDevice_deviceCode_key" ON "TransportDevice"("deviceCode");
CREATE INDEX "TransportDevice_busId_idx" ON "TransportDevice"("busId");

CREATE TABLE "TransportCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "TransportCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "TransportCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransportCard_qrToken_key" ON "TransportCard"("qrToken");
CREATE INDEX "TransportCard_studentId_status_idx" ON "TransportCard"("studentId", "status");

CREATE TABLE "TransportAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransportAssignment_studentId_effectiveFrom_idx" ON "TransportAssignment"("studentId", "effectiveFrom");
CREATE INDEX "TransportAssignment_busId_effectiveFrom_effectiveTo_idx" ON "TransportAssignment"("busId", "effectiveFrom", "effectiveTo");

CREATE TABLE "TransportTrip" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "direction" "TransportTripDirection" NOT NULL,
    "status" "TransportTripStatus" NOT NULL DEFAULT 'OPEN',
    "operatorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportTrip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransportTrip_busId_serviceDate_direction_key" ON "TransportTrip"("busId", "serviceDate", "direction");
CREATE INDEX "TransportTrip_serviceDate_direction_idx" ON "TransportTrip"("serviceDate", "direction");

CREATE TABLE "TransportBoardingEvent" (
    "id" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cardId" TEXT,
    "deviceId" TEXT,
    "operatorId" TEXT,
    "deviceCapturedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "TransportBoardingSource" NOT NULL,
    "assignmentStatus" "TransportAssignmentStatus" NOT NULL,
    "rosterVersion" TEXT,
    "syncBatchId" TEXT,
    "manualReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportBoardingEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransportBoardingEvent_clientEventId_key" ON "TransportBoardingEvent"("clientEventId");
CREATE UNIQUE INDEX "TransportBoardingEvent_tripId_studentId_key" ON "TransportBoardingEvent"("tripId", "studentId");
CREATE INDEX "TransportBoardingEvent_studentId_deviceCapturedAt_idx" ON "TransportBoardingEvent"("studentId", "deviceCapturedAt");
CREATE INDEX "TransportBoardingEvent_tripId_idx" ON "TransportBoardingEvent"("tripId");

ALTER TABLE "TransportDevice" ADD CONSTRAINT "TransportDevice_busId_fkey" FOREIGN KEY ("busId") REFERENCES "TransportBus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransportCard" ADD CONSTRAINT "TransportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportAssignment" ADD CONSTRAINT "TransportAssignment_busId_fkey" FOREIGN KEY ("busId") REFERENCES "TransportBus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_busId_fkey" FOREIGN KEY ("busId") REFERENCES "TransportBus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportBoardingEvent" ADD CONSTRAINT "TransportBoardingEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransportBoardingEvent" ADD CONSTRAINT "TransportBoardingEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportBoardingEvent" ADD CONSTRAINT "TransportBoardingEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "TransportCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransportBoardingEvent" ADD CONSTRAINT "TransportBoardingEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "TransportDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
