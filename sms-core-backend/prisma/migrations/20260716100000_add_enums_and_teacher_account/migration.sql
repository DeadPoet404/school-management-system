-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('PENDING', 'CLEARED', 'DENIED', 'NOT_APPLICABLE', 'EXEMPT');

-- AlterTable: Invoice.status — drop default, cast, then re-add default
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus" USING "status"::"InvoiceStatus";
ALTER TABLE "Invoice" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'UNPAID'::"InvoiceStatus";

-- AlterTable: TeacherDeparture — safe cast for both clearance fields
ALTER TABLE "TeacherDeparture" ALTER COLUMN "academicClearanceStatus" TYPE "ClearanceStatus" USING "academicClearanceStatus"::"ClearanceStatus";
ALTER TABLE "TeacherDeparture" ALTER COLUMN "academicClearanceStatus" SET NOT NULL;
ALTER TABLE "TeacherDeparture" ALTER COLUMN "treasuryClearanceStatus" TYPE "ClearanceStatus" USING "treasuryClearanceStatus"::"ClearanceStatus";
ALTER TABLE "TeacherDeparture" ALTER COLUMN "treasuryClearanceStatus" SET NOT NULL;

-- AlterTable: StaffDeparture — safe cast for all three clearance fields
ALTER TABLE "StaffDeparture" ALTER COLUMN "hrClearanceStatus" TYPE "ClearanceStatus" USING "hrClearanceStatus"::"ClearanceStatus";
ALTER TABLE "StaffDeparture" ALTER COLUMN "hrClearanceStatus" SET NOT NULL;
ALTER TABLE "StaffDeparture" ALTER COLUMN "itAssetReturnStatus" TYPE "ClearanceStatus" USING "itAssetReturnStatus"::"ClearanceStatus";
ALTER TABLE "StaffDeparture" ALTER COLUMN "itAssetReturnStatus" SET NOT NULL;
ALTER TABLE "StaffDeparture" ALTER COLUMN "treasuryClearanceStatus" TYPE "ClearanceStatus" USING "treasuryClearanceStatus"::"ClearanceStatus";
ALTER TABLE "StaffDeparture" ALTER COLUMN "treasuryClearanceStatus" SET NOT NULL;

-- CreateTable: TeacherAccount
CREATE TABLE "TeacherAccount" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'FACULTY',

    CONSTRAINT "TeacherAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAccount_teacherId_key" ON "TeacherAccount"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAccount_email_key" ON "TeacherAccount"("email");

-- AddForeignKey
ALTER TABLE "TeacherAccount" ADD CONSTRAINT "TeacherAccount_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
