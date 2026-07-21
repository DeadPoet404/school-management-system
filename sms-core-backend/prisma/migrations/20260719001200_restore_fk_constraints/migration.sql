-- Restore FK constraints dropped by Prisma migration drift in add_invoice_paid_amount.
-- These columns are plain String fields in Prisma schema (no @relation decorator)
-- but have database-level FK integrity for data safety.

ALTER TABLE "Placement" ADD CONSTRAINT "Placement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL;

ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_department_fkey" FOREIGN KEY ("department") REFERENCES "Department"("id") ON DELETE SET NULL;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_subject_fkey" FOREIGN KEY ("subject") REFERENCES "Subject"("id") ON DELETE SET NULL;

ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT;
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT;
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT;

ALTER TABLE "BillingLedger" ADD CONSTRAINT "BillingLedger_feeTierId_fkey" FOREIGN KEY ("feeTierId") REFERENCES "FeeTier"("id") ON DELETE SET NULL;
