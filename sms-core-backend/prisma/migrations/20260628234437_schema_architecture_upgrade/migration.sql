/*
  Warnings:

  - You are about to alter the column `initialDeposit` on the `BillingLedger` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `currentBalance` on the `BillingLedger` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `lateFeeRate` column on the `FeeStructureConfiguration` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `amount` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `status` column on the `Staff` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `baseSalary` on the `StaffPayroll` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `salaryStatus` column on the `StaffPayroll` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Student` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `teacherName` on the `SubjectAllocation` table. All the data in the column will be lost.
  - The `status` column on the `Teacher` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[configurationId,periodNumber,dayOfWeek]` on the table `TimetablePeriod` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `amount` on the `FeeComponent` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `issueDate` on the `FeeStructureConfiguration` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `dueDate` on the `FeeStructureConfiguration` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `departureType` on the `StudentDeparture` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `treasuryClearanceStatus` on the `StudentDeparture` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `teacherId` to the `SubjectAllocation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEPARTED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('PENDING', 'DISBURSED');

-- CreateEnum
CREATE TYPE "DepartureType" AS ENUM ('GRADUATION', 'TRANSFER', 'VOLUNTARY_WITHDRAWAL', 'EXPULSION', 'OTHER');

-- CreateEnum
CREATE TYPE "TreasuryClearanceStatus" AS ENUM ('FULLY_SETTLED', 'OUTSTANDING_DEBT', 'WRITTEN_OFF', 'EXEMPT');

-- DropIndex
DROP INDEX "Guardian_studentId_key";

-- DropIndex
DROP INDEX "TimetablePeriod_configurationId_periodNumber_key";

-- AlterTable
ALTER TABLE "BillingLedger" ALTER COLUMN "initialDeposit" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "currentBalance" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "FeeComponent" DROP COLUMN "amount",
ADD COLUMN     "amount" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "FeeStructureConfiguration" DROP COLUMN "issueDate",
ADD COLUMN     "issueDate" TIMESTAMP(3) NOT NULL,
DROP COLUMN "dueDate",
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
DROP COLUMN "lateFeeRate",
ADD COLUMN     "lateFeeRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "status",
ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "StaffPayroll" ALTER COLUMN "baseSalary" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "salaryStatus",
ADD COLUMN     "salaryStatus" "PayrollStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "status",
ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "currentGpa" SET DEFAULT 0.0;

-- AlterTable
ALTER TABLE "StudentDeparture" DROP COLUMN "departureType",
ADD COLUMN     "departureType" "DepartureType" NOT NULL,
DROP COLUMN "treasuryClearanceStatus",
ADD COLUMN     "treasuryClearanceStatus" "TreasuryClearanceStatus" NOT NULL;

-- AlterTable
ALTER TABLE "SubjectAllocation" DROP COLUMN "teacherName",
ADD COLUMN     "dayOfWeek" TEXT,
ADD COLUMN     "teacherId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" DROP COLUMN "status",
ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TimetableBreak" ADD COLUMN     "dayOfWeek" TEXT;

-- AlterTable
ALTER TABLE "TimetablePeriod" ADD COLUMN     "dayOfWeek" TEXT;

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "code" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "debit" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "credit" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "Guardian_studentId_idx" ON "Guardian"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePeriod_configurationId_periodNumber_dayOfWeek_key" ON "TimetablePeriod"("configurationId", "periodNumber", "dayOfWeek");
