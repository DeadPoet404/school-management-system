-- P1-10: Add foreign key constraints to prevent orphan records.
-- Strategy: make columns nullable, clean orphans, then add FK constraints.
-- ON DELETE SET NULL ensures deleting a reference record doesn't cascade-delete
-- student/teacher/financial records, but instead nullifies the FK column.

-- Step 1: Make FK columns nullable (required for SET NULL semantics)
ALTER TABLE "Placement" ALTER COLUMN "classId" DROP NOT NULL;
ALTER TABLE "Teacher" ALTER COLUMN "department" DROP NOT NULL;
ALTER TABLE "Teacher" ALTER COLUMN "subject" DROP NOT NULL;
ALTER TABLE "BillingLedger" ALTER COLUMN "feeTierId" DROP NOT NULL;

-- Step 2: Clean up existing orphaned records by setting FK to NULL
UPDATE "Placement" SET "classId" = NULL WHERE "classId" IS NOT NULL AND "classId" NOT IN (SELECT id FROM "Class");
UPDATE "Teacher" SET "department" = NULL WHERE "department" IS NOT NULL AND "department" NOT IN (SELECT name FROM "Department");
UPDATE "Teacher" SET "subject" = NULL WHERE "subject" IS NOT NULL AND "subject" NOT IN (SELECT name FROM "Subject");
UPDATE "BillingLedger" SET "feeTierId" = NULL WHERE "feeTierId" IS NOT NULL AND "feeTierId" NOT IN (SELECT code FROM "FeeTier");

-- Step 3: Add foreign key constraints
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_department_fkey" FOREIGN KEY ("department") REFERENCES "Department"("name") ON DELETE SET NULL;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_subject_fkey" FOREIGN KEY ("subject") REFERENCES "Subject"("name") ON DELETE SET NULL;
ALTER TABLE "BillingLedger" ADD CONSTRAINT "BillingLedger_feeTierId_fkey" FOREIGN KEY ("feeTierId") REFERENCES "FeeTier"("code") ON DELETE SET NULL;

-- Step 4: Add FK constraints for GradeRecord (0 orphans, but prevents future ones)
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL;
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL;
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL;
