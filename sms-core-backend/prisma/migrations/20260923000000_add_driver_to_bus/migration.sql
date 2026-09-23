-- Add driver assignment to TransportBus. A bus can have at most one active driver;
-- a driver can drive multiple buses (e.g. morning/evening). Driver is Staff.id.
-- Staff drivenBuses relation added for reverse lookup.

-- AlterTable
ALTER TABLE "TransportBus" ADD COLUMN "driverStaffId" TEXT;

-- AddForeignKey
ALTER TABLE "TransportBus" ADD CONSTRAINT "TransportBus_driverStaffId_fkey" FOREIGN KEY ("driverStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TransportBus_driverStaffId_idx" ON "TransportBus"("driverStaffId");
