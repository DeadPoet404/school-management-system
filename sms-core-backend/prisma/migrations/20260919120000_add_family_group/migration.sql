-- Persist only staff-confirmed family grouping in this first increment.
-- Discount invoice-period semantics and discount application audit records
-- remain intentionally separate until the policy is agreed.
CREATE TABLE "FamilyGroup" (
    "id" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "familyName" TEXT,
    "primaryPhone" TEXT,
    "primaryEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyGroup_matchKey_key" ON "FamilyGroup"("matchKey");
CREATE INDEX "FamilyGroup_primaryPhone_idx" ON "FamilyGroup"("primaryPhone");
CREATE INDEX "FamilyGroup_primaryEmail_idx" ON "FamilyGroup"("primaryEmail");

ALTER TABLE "Student" ADD COLUMN "familyGroupId" TEXT;
CREATE INDEX "Student_familyGroupId_idx" ON "Student"("familyGroupId");


ALTER TABLE "Guardian" ADD COLUMN "phoneNormalized" TEXT;
ALTER TABLE "Guardian" ADD COLUMN "emailNormalized" TEXT;

-- Backfill the canonical keys so existing guardian records participate in
-- lookup immediately. Display phone/email values are deliberately preserved.
UPDATE "Guardian"
SET "phoneNormalized" = CASE
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') LIKE '0%'
      THEN '233' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 2)
    ELSE regexp_replace("phone", '[^0-9]', '', 'g')
END;
UPDATE "Guardian"
SET "emailNormalized" = NULLIF(lower(trim("email")), '');

CREATE INDEX "Guardian_phoneNormalized_idx" ON "Guardian"("phoneNormalized");
CREATE INDEX "Guardian_emailNormalized_idx" ON "Guardian"("emailNormalized");

ALTER TABLE "Student" ADD CONSTRAINT "Student_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
