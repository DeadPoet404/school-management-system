-- DropForeignKey
ALTER TABLE "BillingLedger" DROP CONSTRAINT "BillingLedger_feeTierId_fkey";

-- DropForeignKey
ALTER TABLE "GradeRecord" DROP CONSTRAINT "GradeRecord_classId_fkey";

-- DropForeignKey
ALTER TABLE "GradeRecord" DROP CONSTRAINT "GradeRecord_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "GradeRecord" DROP CONSTRAINT "GradeRecord_termId_fkey";

-- DropForeignKey
ALTER TABLE "Placement" DROP CONSTRAINT "Placement_classId_fkey";

-- DropForeignKey
ALTER TABLE "Teacher" DROP CONSTRAINT "Teacher_department_fkey";

-- DropForeignKey
ALTER TABLE "Teacher" DROP CONSTRAINT "Teacher_subject_fkey";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
