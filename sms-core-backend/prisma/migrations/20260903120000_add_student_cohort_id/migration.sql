-- Cohort-based student identifiers.
-- legacyStudentId preserves the pre-migration business key (JCS-0227,
-- STU-2026-v2sghh) so historical receipts and invoices remain traceable.
-- cohortYear is the academic year the student is due to complete JHS 3.
-- Both are nullable: the backfill script populates them, and nothing is
-- lost if it has not run yet.

ALTER TABLE "Student" ADD COLUMN "legacyStudentId" TEXT;
ALTER TABLE "Student" ADD COLUMN "cohortYear" INTEGER;

CREATE UNIQUE INDEX "Student_legacyStudentId_key" ON "Student"("legacyStudentId");
