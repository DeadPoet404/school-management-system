-- CreateTable
CREATE TABLE "StudentDeparture" (
    "id" TEXT NOT NULL,
    "studentInternalId" TEXT NOT NULL,
    "departureType" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "destinationInstitution" TEXT NOT NULL DEFAULT 'N/A',
    "treasuryClearanceStatus" TEXT NOT NULL,
    "academicRecordsArchived" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDeparture_studentInternalId_idx" ON "StudentDeparture"("studentInternalId");

-- AddForeignKey
ALTER TABLE "StudentDeparture" ADD CONSTRAINT "StudentDeparture_studentInternalId_fkey" FOREIGN KEY ("studentInternalId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
