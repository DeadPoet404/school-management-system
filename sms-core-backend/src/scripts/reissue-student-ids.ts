/**
 * Reissue every student's business key into the cohort scheme.
 *
 *   JCS-<2-digit JHS3 completion year>-<3-digit sequence>   e.g. JCS-39-014
 *
 * Cohort is derived from the student's CURRENT class, so this must run
 * AFTER consolidate-classes.ts has produced the canonical 27-class ladder.
 * Unrecognised class names abort the run rather than guess a year group.
 *
 * Safety:
 *   - dry run by default; --apply to write
 *   - the old id is copied to Student.legacyStudentId, never discarded
 *   - Student.id (the UUID foreign keys point at) is never touched, so
 *     invoices, payments, grades and attendance are structurally unaffected
 *   - refuses to run twice: students already holding a JCS-nn-nnn id and a
 *     populated legacyStudentId are skipped
 *   - sequence numbers are assigned in enrollmentDate order, oldest first
 *
 * Usage (inside the backend container):
 *   node dist/scripts/reissue-student-ids.js
 *   node dist/scripts/reissue-student-ids.js --apply
 *   node dist/scripts/reissue-student-ids.js --apply --academic-year=2026
 */

import { PrismaClient } from '@prisma/client';
import {
  academicYearOf,
  cohortForClass,
  formatStudentId,
  parseStudentId,
  cohortLabel,
} from '../lib/student-id';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const yearArg = process.argv.find((a) => a.startsWith('--academic-year='));
const ACADEMIC_YEAR = yearArg
  ? Number(yearArg.split('=')[1])
  : academicYearOf(new Date());

type Row = {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentDate: Date;
  legacyStudentId: string | null;
  className: string | null;
};

async function main() {
  if (!Number.isInteger(ACADEMIC_YEAR) || ACADEMIC_YEAR < 2000 || ACADEMIC_YEAR > 2100) {
    throw new Error(`Invalid --academic-year: ${ACADEMIC_YEAR}`);
  }

  console.log(`mode          : ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`);
  console.log(`academic year : ${ACADEMIC_YEAR}`);
  console.log('');

  const students = await prisma.student.findMany({
    select: {
      id: true,
      studentId: true,
      studentName: true,
      enrollmentDate: true,
      legacyStudentId: true,
      placement: { select: { class: { select: { name: true } } } },
    },
    orderBy: { enrollmentDate: 'asc' },
  });

  const rows: Row[] = students.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    studentName: s.studentName,
    enrollmentDate: s.enrollmentDate,
    legacyStudentId: s.legacyStudentId,
    className: s.placement?.class?.name ?? null,
  }));

  console.log(`students found: ${rows.length}`);

  // Already migrated -> skip, so the script is safe to re-run.
  const alreadyDone = rows.filter(
    (r) => parseStudentId(r.studentId) !== null && r.legacyStudentId !== null
  );
  const todo = rows.filter((r) => !alreadyDone.includes(r));
  if (alreadyDone.length > 0) {
    console.log(`already reissued (skipped): ${alreadyDone.length}`);
  }

  // Unplaced students cannot be given a year group.
  const unplaced = todo.filter((r) => !r.className || r.className === 'Unassigned');
  const placed = todo.filter((r) => !unplaced.includes(r));

  // Unknown class labels abort: never guess a child's year group.
  const unknown: Row[] = [];
  for (const r of placed) {
    if (cohortForClass(r.className as string, ACADEMIC_YEAR) === null) unknown.push(r);
  }
  if (unknown.length > 0) {
    console.error(`\nABORT: ${unknown.length} student(s) sit in classes outside the canonical ladder.`);
    const labels = [...new Set(unknown.map((r) => r.className))].sort();
    for (const l of labels) console.error(`  unmapped class: ${l}`);
    console.error('\nRun consolidate-classes.ts --apply first, then retry.');
    process.exitCode = 1;
    return;
  }

  // Group by cohort, then assign sequences in enrollment order.
  const byCohort = new Map<number, Row[]>();
  for (const r of placed) {
    const c = cohortForClass(r.className as string, ACADEMIC_YEAR) as number;
    if (!byCohort.has(c)) byCohort.set(c, []);
    (byCohort.get(c) as Row[]).push(r);
  }

  const plan: Array<{ row: Row; cohort: number; newId: string }> = [];
  for (const cohort of [...byCohort.keys()].sort((a, b) => a - b)) {
    const group = (byCohort.get(cohort) as Row[]).slice().sort(
      (a, b) =>
        a.enrollmentDate.getTime() - b.enrollmentDate.getTime() ||
        a.studentId.localeCompare(b.studentId)
    );
    group.forEach((row, i) => {
      plan.push({ row, cohort, newId: formatStudentId(cohort, i + 1) });
    });
  }

  console.log('');
  console.log('COHORT PLAN');
  console.log('-'.repeat(64));
  for (const cohort of [...byCohort.keys()].sort((a, b) => a - b)) {
    const group = byCohort.get(cohort) as Row[];
    const classes = [...new Set(group.map((r) => r.className))].sort().join(', ');
    const remaining = cohort - ACADEMIC_YEAR;
    console.log(
      `${cohortLabel(cohort).padEnd(15)} ${String(group.length).padStart(3)} students  ` +
        `${String(remaining).padStart(2)}y left  ${classes}`
    );
  }
  console.log('-'.repeat(64));
  console.log(`total to reissue: ${plan.length}`);
  if (unplaced.length > 0) {
    console.log(`\nUNPLACED (left unchanged, registrar must assign a class):`);
    for (const r of unplaced) {
      console.log(`  ${r.studentId.padEnd(22)} ${r.studentName}`);
    }
  }

  // Collision guard: the new ids must be unique among themselves and must
  // not collide with any id we are leaving in place.
  const newIds = plan.map((p) => p.newId);
  const dupes = newIds.filter((v, i) => newIds.indexOf(v) !== i);
  if (dupes.length > 0) {
    console.error(`\nABORT: duplicate generated ids: ${[...new Set(dupes)].join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const untouched = new Set([...alreadyDone, ...unplaced].map((r) => r.studentId));
  const clash = newIds.filter((n) => untouched.has(n));
  if (clash.length > 0) {
    console.error(`\nABORT: generated ids collide with retained ids: ${clash.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nSAMPLE (first 10)');
  for (const p of plan.slice(0, 10)) {
    console.log(
      `  ${p.row.studentId.padEnd(22)} -> ${p.newId.padEnd(12)} ` +
        `${(p.row.className as string).padEnd(12)} ${p.row.studentName}`
    );
  }

  if (!APPLY) {
    console.log('\nDRY RUN complete. No changes written. Re-run with --apply to commit.');
    return;
  }

  // Two-phase write. Student.studentId is @unique, so a direct rename can
  // collide with an id still held by another row (exactly the failure the
  // class consolidation hit). Park every row on a temporary id first, then
  // claim the final ids once the namespace is clear.
  console.log('\nAPPLYING...');
  let parked = 0;
  for (const p of plan) {
    await prisma.student.update({
      where: { id: p.row.id },
      data: { studentId: `tmp:${p.row.id}` },
    });
    parked++;
  }
  console.log(`  phase 1: parked ${parked} rows on temporary ids`);

  let written = 0;
  for (const p of plan) {
    await prisma.student.update({
      where: { id: p.row.id },
      data: {
        studentId: p.newId,
        legacyStudentId: p.row.legacyStudentId ?? p.row.studentId,
        cohortYear: p.cohort,
      },
    });
    written++;
  }
  console.log(`  phase 2: wrote ${written} cohort ids`);

  const stranded = await prisma.student.count({
    where: { studentId: { startsWith: 'tmp:' } },
  });
  console.log(`\nverification: rows still on a temporary id: ${stranded}`);
  if (stranded > 0) {
    console.error('WARNING: some rows did not receive a final id. Investigate before use.');
    process.exitCode = 1;
    return;
  }
  const withCohort = await prisma.student.count({ where: { cohortYear: { not: null } } });
  const withLegacy = await prisma.student.count({
    where: { legacyStudentId: { not: null } },
  });
  console.log(`students with a cohort year : ${withCohort}`);
  console.log(`students with a legacy id   : ${withLegacy}`);
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
