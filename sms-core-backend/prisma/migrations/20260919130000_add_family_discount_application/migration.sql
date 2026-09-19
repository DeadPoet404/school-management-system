-- Explicit staff-approved family discount. The discount is applied only to
-- the new enrollment invoice; existing invoices and payment history are not
-- rewritten. One application is allowed per family group per academic year.
CREATE TYPE "FamilyDiscountRule" AS ENUM ('THREE_WARDS', 'FOUR_PLUS_WARDS');

ALTER TABLE "Invoice" ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "discountDescription" TEXT;

CREATE TABLE "FamilyDiscountApplication" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "rule" "FamilyDiscountRule" NOT NULL,
    "approvedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyDiscountApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyDiscountApplication_invoiceId_key" ON "FamilyDiscountApplication"("invoiceId");
CREATE UNIQUE INDEX "FamilyDiscountApplication_familyGroupId_academicYear_key" ON "FamilyDiscountApplication"("familyGroupId", "academicYear");
CREATE INDEX "FamilyDiscountApplication_studentId_idx" ON "FamilyDiscountApplication"("studentId");
CREATE INDEX "FamilyDiscountApplication_academicYear_idx" ON "FamilyDiscountApplication"("academicYear");

ALTER TABLE "FamilyDiscountApplication" ADD CONSTRAINT "FamilyDiscountApplication_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FamilyDiscountApplication" ADD CONSTRAINT "FamilyDiscountApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FamilyDiscountApplication" ADD CONSTRAINT "FamilyDiscountApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
