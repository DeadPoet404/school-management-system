/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function checkOrphans() {
  const checks = [
    {
      name: "Placement.classId -> Class.id",
      sql: 'SELECT COUNT(*)::int AS n FROM "Placement" p LEFT JOIN "Class" c ON p."classId" = c.id WHERE p."classId" IS NOT NULL AND c.id IS NULL',
    },
    {
      name: "GradeRecord.classId -> Class.id",
      sql: 'SELECT COUNT(*)::int AS n FROM "GradeRecord" g LEFT JOIN "Class" c ON g."classId" = c.id WHERE c.id IS NULL',
    },
    {
      name: "GradeRecord.subjectId -> Subject.id",
      sql: 'SELECT COUNT(*)::int AS n FROM "GradeRecord" g LEFT JOIN "Subject" s ON g."subjectId" = s.id WHERE s.id IS NULL',
    },
    {
      name: "GradeRecord.termId -> Term.id",
      sql: 'SELECT COUNT(*)::int AS n FROM "GradeRecord" g LEFT JOIN "Term" t ON g."termId" = t.id WHERE t.id IS NULL',
    },
    {
      name: "TimetableConfiguration.sectionId -> Class.id",
      sql: 'SELECT COUNT(*)::int AS n FROM "TimetableConfiguration" tc LEFT JOIN "Class" c ON tc."sectionId" = c.id WHERE c.id IS NULL',
    },
    {
      name: "FeeStructureConfiguration.sectionId -> Class.id",
      sql: 'SELECT COUNT(*)::int AS n FROM "FeeStructureConfiguration" f LEFT JOIN "Class" c ON f."sectionId" = c.id WHERE c.id IS NULL',
    },
    {
      name: "PaymentCollection.sectionId -> Class.id",
      sql: 'SELECT COUNT(*)::int AS n FROM "PaymentCollection" pc LEFT JOIN "Class" c ON pc."sectionId" = c.id WHERE c.id IS NULL',
    },
  ];
  for (const check of checks) {
    const result: Array<{ n: number }> = await prisma.$queryRawUnsafe(check.sql);
    const count = result[0]?.n ?? 0;
    console.log(
      count > 0
        ? "⚠️  " + check.name + ": " + count + " orphan(s)"
        : "✅ " + check.name + ": 0 orphan(s)",
    );
  }
}
checkOrphans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
