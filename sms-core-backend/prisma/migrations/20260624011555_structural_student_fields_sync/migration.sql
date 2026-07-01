-- AlterTable
ALTER TABLE "Demographics" ADD COLUMN     "bloodType" TEXT,
ADD COLUMN     "formerSchool" TEXT,
ADD COLUMN     "religion" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "attendanceRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
ADD COLUMN     "currentGpa" DOUBLE PRECISION NOT NULL DEFAULT 4.0;
