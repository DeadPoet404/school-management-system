-- PR2: Canonical class identity
-- Invariant: TimetableConfiguration.sectionId, FeeStructureConfiguration.sectionId,
-- and PaymentCollection.sectionId MUST equal Class.id (UUID), never Class.section
-- letters (A/B) and never frontend tokens (jhs-1, grade-1, pre-school).

-- 1) Drop rows that cannot satisfy the FK (legacy tokens / orphans).
--    Seed data already uses Class.id; this only cleans incompatible leftovers.
DELETE FROM "SubjectAllocation" sa
WHERE sa."configurationId" IN (
  SELECT tc.id FROM "TimetableConfiguration" tc
  LEFT JOIN "Class" c ON c.id = tc."sectionId"
  WHERE c.id IS NULL
);

DELETE FROM "TimetablePeriod" tp
WHERE tp."configurationId" IN (
  SELECT tc.id FROM "TimetableConfiguration" tc
  LEFT JOIN "Class" c ON c.id = tc."sectionId"
  WHERE c.id IS NULL
);

DELETE FROM "TimetableBreak" tb
WHERE tb."configurationId" IN (
  SELECT tc.id FROM "TimetableConfiguration" tc
  LEFT JOIN "Class" c ON c.id = tc."sectionId"
  WHERE c.id IS NULL
);

DELETE FROM "TimetableConfiguration" tc
WHERE NOT EXISTS (SELECT 1 FROM "Class" c WHERE c.id = tc."sectionId");

DELETE FROM "FeeComponent" fc
WHERE fc."configId" IN (
  SELECT f.id FROM "FeeStructureConfiguration" f
  LEFT JOIN "Class" c ON c.id = f."sectionId"
  WHERE c.id IS NULL
);

DELETE FROM "FeeStructureConfiguration" f
WHERE NOT EXISTS (SELECT 1 FROM "Class" c WHERE c.id = f."sectionId");

DELETE FROM "PaymentCollection" pc
WHERE NOT EXISTS (SELECT 1 FROM "Class" c WHERE c.id = pc."sectionId");

-- 2) Add foreign keys enforcing the invariant.
ALTER TABLE "TimetableConfiguration"
  ADD CONSTRAINT "TimetableConfiguration_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Class"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "FeeStructureConfiguration"
  ADD CONSTRAINT "FeeStructureConfiguration_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Class"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "PaymentCollection"
  ADD CONSTRAINT "PaymentCollection_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Class"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
