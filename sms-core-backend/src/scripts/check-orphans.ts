/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function checkOrphans() {
  const checks = [
    { name: "Placement.classId -> Class.id", sql: "SELECT COUNT(*)::int AS n FROM \"Placement\" p LEFT JOIN \"Class\" c ON p.\"classId\" = c.id WHERE c.id IS NULL" },
    { name: "Teacher.department -> Department.name", sql: "SELECT COUNT(*)::int AS n FROM \"Teacher\" t LEFT JOIN \"Department\" d ON t.department = d.name WHERE d.id IS NULL" },
    { name: "Teacher.subject -> Subject.name", sql: "SELECT COUNT(*)::int AS n FROM \"Teacher\" t LEFT JOIN \"Subject\" s ON t.subject = s.name WHERE s.id IS NULL" },
    { name: "BillingLedger.feeTierId -> FeeTier.code", sql: "SELECT COUNT(*)::int AS n FROM \"BillingLedger\" b LEFT JOIN \"FeeTier\" f ON b.\"feeTierId\" = f.code WHERE f.id IS NULL" },
    { name: "GradeRecord.classId -> Class.id", sql: "SELECT COUNT(*)::int AS n FROM \"GradeRecord\" g LEFT JOIN \"Class\" c ON g.\"classId\" = c.id WHERE c.id IS NULL" },
    { name: "GradeRecord.subjectId -> Subject.id", sql: "SELECT COUNT(*)::int AS n FROM \"GradeRecord\" g LEFT JOIN \"Subject\" s ON g.\"subjectId\" = s.id WHERE s.id IS NULL" },
    { name: "GradeRecord.termId -> Term.id", sql: "SELECT COUNT(*)::int AS n FROM \"GradeRecord\" g LEFT JOIN \"Term\" t ON g.\"termId\" = t.id WHERE t.id IS NULL" },
  ];
  for (const check of checks) {
    const result: Array<{ n: number }> = await prisma.$queryRawUnsafe(check.sql);
    const count = result[0]?.n ?? 0;
    console.log(count > 0 ? "⚠️  " + check.name + ": " + count + " orphan(s)" : "✅ " + check.name + ": 0 orphan(s)");
  }
}
checkOrphans().catch(console.error).finally(() => prisma.$disconnect());
