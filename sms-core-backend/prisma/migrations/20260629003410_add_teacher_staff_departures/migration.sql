-- CreateEnum
CREATE TYPE "PersonnelDepartureType" AS ENUM ('RESIGNATION', 'TERMINATION', 'RETIREMENT', 'CONTRACT_END', 'OTHER');

-- CreateTable
CREATE TABLE "TeacherDeparture" (
    "id" TEXT NOT NULL,
    "teacherInternalId" TEXT NOT NULL,
    "departureType" "PersonnelDepartureType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "academicClearanceStatus" TEXT NOT NULL,
    "treasuryClearanceStatus" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDeparture" (
    "id" TEXT NOT NULL,
    "staffInternalId" TEXT NOT NULL,
    "departureType" "PersonnelDepartureType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "hrClearanceStatus" TEXT NOT NULL,
    "itAssetReturnStatus" TEXT NOT NULL,
    "treasuryClearanceStatus" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherDeparture_teacherInternalId_idx" ON "TeacherDeparture"("teacherInternalId");

-- CreateIndex
CREATE INDEX "StaffDeparture_staffInternalId_idx" ON "StaffDeparture"("staffInternalId");

-- AddForeignKey
ALTER TABLE "TeacherDeparture" ADD CONSTRAINT "TeacherDeparture_teacherInternalId_fkey" FOREIGN KEY ("teacherInternalId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDeparture" ADD CONSTRAINT "StaffDeparture_staffInternalId_fkey" FOREIGN KEY ("staffInternalId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
