/**
 * Class ladder consolidation.
 *
 * Production accumulated two parallel class systems: 22 seeded classes
 * ("Grade 3 A", "JHS 1 A") holding 5 students, and 19 classes created by the
 * CSV import ("Primary 3", "J.H.S 1", "Pre-School (K.G 2 A)") holding 494.
 * Naming is inconsistent even within the import set.
 *
 * This script folds both into one canonical ladder:
 *
 *   Creche -> Nursery 1A/1B -> Nursery 2A/2B -> KG 1A/1B -> KG 2A/2B
 *          -> Grade 1A..6B -> JHS 1A..3B
 *
 * Class.id is never changed. For each canonical label one existing row is
 * chosen as the survivor (the one holding the most placements) and renamed;
 * every other row mapping to that label has its references repointed at the
 * survivor and is then deactivated. Deactivation rather than deletion keeps
 * historical foreign keys intact.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --apply.
 *
 *   node dist/scripts/consolidate-classes.js
 *   node dist/scripts/consolidate-classes.js --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Canonical ladder, in teaching order. */
const LADDER: string[] = [
  'Creche',
  'Nursery 1A', 'Nursery 1B',
  'Nursery 2A', 'Nursery 2B',
  'KG 1A', 'KG 1B',
  'KG 2A', 'KG 2B',
  'Grade 1A', 'Grade 1B',
  'Grade 2A', 'Grade 2B',
  'Grade 3A', 'Grade 3B',
  'Grade 4A', 'Grade 4B',
  'Grade 5A', 'Grade 5B',
  'Grade 6A', 'Grade 6B',
  'JHS 1A', 'JHS 1B',
  'JHS 2A', 'JHS 2B',
  'JHS 3A', 'JHS 3B',
];

/**
 * Explicit mapping for every label observed in production. Kept explicit
 * rather than inferred: a regex that silently mis-files a class would move
 * real children into the wrong year group.
 *
 * Classes with no section letter map to section A, per the school's decision.
 */
const EXPLICIT: Record<string, string> = {
  // Creche
  'creche': 'Creche',
  'pre-school (crèche)': 'Creche',
  'pre-school (creche)': 'Creche',

  // Nursery
  'nursery 1 a': 'Nursery 1A',
  'nursery 1': 'Nursery 1A',
  'nursery 1 b': 'Nursery 1B',
  'nursery 2 a': 'Nursery 2A',
  'pre-school(nursery 2 a)': 'Nursery 2A',
  'pre-school (nursery 2 a)': 'Nursery 2A',
  'nursery 2 b': 'Nursery 2B',

  // Kindergarten
  'pre-school (k.g. 1a)': 'KG 1A',
  'pre-school (k.g 1a)': 'KG 1A',
  'pre-school (k.g 1b)': 'KG 1B',
  'pre-school (k.g 2 a)': 'KG 2A',
  'pre-school (k.g 2 b)': 'KG 2B',

  // Primary -> Grade
  'grade 1 a': 'Grade 1A', 'primary 1': 'Grade 1A',
  'grade 1 b': 'Grade 1B', 'primary 1 b': 'Grade 1B',
  'grade 2 a': 'Grade 2A', 'primary 2a': 'Grade 2A',
  'grade 2 b': 'Grade 2B', 'primary 2b': 'Grade 2B',
  'grade 3 a': 'Grade 3A', 'primary 3': 'Grade 3A',
  'grade 3 b': 'Grade 3B',
  'grade 4 a': 'Grade 4A', 'primary 4': 'Grade 4A',
  'grade 4 b': 'Grade 4B',
  'grade 5 a': 'Grade 5A', 'primary 5': 'Grade 5A',
  'grade 5 b': 'Grade 5B',
  'grade 6 a': 'Grade 6A', 'primary 6': 'Grade 6A',
  'grade 6 b': 'Grade 6B',

  // JHS
  'jhs 1 a': 'JHS 1A', 'j.h.s 1': 'JHS 1A',
  'jhs 1 b': 'JHS 1B',
  'jhs 2 a': 'JHS 2A', 'j.h.s 2': 'JHS 2A',
  'jhs 2 b': 'JHS 2B',
  'jhs 3 a': 'JHS 3A', 'j.h.s 3': 'JHS 3A',
  'jhs 3 b': 'JHS 3B',
};

/** Left untouched: it is a real placement state, not a mis-named class. */
const PRESERVE = new Set(['unassigned']);

function canonicalFor(name: string): string | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (PRESERVE.has(key)) return null;
  if (EXPLICIT[key]) return EXPLICIT[key];
  const collapsed = key.replace(/\s+/g, '');
  for (const target of LADDER) {
    if (target.toLowerCase().replace(/\s+/g, '') === collapsed) return target;
  }
  return null;
}

function sectionOf(canonical: string): string | null {
  const m = canonical.match(/([AB])$/);
  return m ? m[1]! : null;
}

async function referenceCounts(classId: string) {
  // AttendanceRecord intentionally absent: it links to Student, not Class,
  // so attendance history follows the student and needs no repointing.
  const [placements, grades, collections, timetables, fees] = await Promise.all([
    prisma.placement.count({ where: { classId } }),
    prisma.gradeRecord.count({ where: { classId } }),
    prisma.paymentCollection.count({ where: { sectionId: classId } }),
    prisma.timetableConfiguration.count({ where: { sectionId: classId } }),
    prisma.feeStructureConfiguration.count({ where: { sectionId: classId } }),
  ]);
  return { placements, grades, collections, timetables, fees };
}

async function main() {
  const apply = process.argv.includes('--apply');

  const existing = await prisma.class.findMany({
    select: { id: true, name: true, section: true, isActive: true, deletedAt: true },
  });

  // Group every existing row under the canonical label it maps to.
  const groups = new Map<string, typeof existing>();
  const unmapped: typeof existing = [];
  const preserved: typeof existing = [];

  for (const cls of existing) {
    const key = cls.name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (PRESERVE.has(key)) { preserved.push(cls); continue; }

    const canonical = canonicalFor(cls.name);
    if (!canonical) { unmapped.push(cls); continue; }

    const bucket = groups.get(canonical) ?? [];
    bucket.push(cls);
    groups.set(canonical, bucket);
  }

  if (unmapped.length > 0) {
    console.log('REFUSING TO PROCEED — unrecognised class labels:\n');
    for (const cls of unmapped) {
      const counts = await referenceCounts(cls.id);
      console.log('  "%s"  placements=%d', cls.name, counts.placements);
    }
    console.log('\nAdd each to the EXPLICIT map, then re-run.');
    console.log('Guessing where these belong risks filing children in the wrong year.');
    return;
  }

  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (no changes written) ===');
  console.log('');

  let renames = 0, merges = 0, creates = 0, deactivations = 0, movedPlacements = 0;

  for (const canonical of LADDER) {
    const members = groups.get(canonical) ?? [];

    if (members.length === 0) {
      console.log('CREATE  %-14s (no existing class maps here)', canonical);
      creates += 1;
      if (apply) {
        await prisma.class.create({
          data: { name: canonical, section: sectionOf(canonical), isActive: true },
        });
      }
      continue;
    }

    // Survivor = most placements, so the fewest records need repointing.
    const scored = await Promise.all(
      members.map(async (m) => ({ cls: m, counts: await referenceCounts(m.id) })),
    );
    scored.sort((a, b) => b.counts.placements - a.counts.placements);

    const survivor = scored[0]!;
    const losers = scored.slice(1);

    if (survivor.cls.name !== canonical) {
      console.log('RENAME  %-28s -> %-14s (placements=%d)',
        `"${survivor.cls.name}"`, canonical, survivor.counts.placements);
      renames += 1;
    } else {
      console.log('KEEP    %-14s (placements=%d)', canonical, survivor.counts.placements);
    }

    if (apply) {
      await prisma.class.update({
        where: { id: survivor.cls.id },
        data: { name: canonical, section: sectionOf(canonical), isActive: true, deletedAt: null },
      });
    }

    for (const loser of losers) {
      const c = loser.counts;
      console.log('  MERGE "%s" -> %s (placements=%d grades=%d collections=%d)',
        loser.cls.name, canonical, c.placements, c.grades, c.collections);
      merges += 1;
      movedPlacements += c.placements;

      if (c.timetables > 0 || c.fees > 0) {
        console.log('    note: timetable=%d fee=%d config(s) on the merged class are left in place',
          c.timetables, c.fees);
        console.log('    (sectionId is unique per class; re-create them against %s if needed)', canonical);
      }

      if (!apply) continue;

      // Repoint every non-unique reference, then retire the duplicate.
      await prisma.$transaction([
        prisma.placement.updateMany({ where: { classId: loser.cls.id }, data: { classId: survivor.cls.id } }),
        prisma.gradeRecord.updateMany({ where: { classId: loser.cls.id }, data: { classId: survivor.cls.id } }),
        prisma.paymentCollection.updateMany({ where: { sectionId: loser.cls.id }, data: { sectionId: survivor.cls.id } }),
        prisma.class.update({
          where: { id: loser.cls.id },
          data: { isActive: false, name: `${loser.cls.name} (merged into ${canonical})` },
        }),
      ]);
      deactivations += 1;
    }
  }

  for (const cls of preserved) {
    const counts = await referenceCounts(cls.id);
    console.log('\nPRESERVED "%s" placements=%d', cls.name, counts.placements);
    if (counts.placements > 0) {
      console.log('  %d student(s) have no real class. The registrar must assign them.', counts.placements);
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log('renamed:            %d', renames);
  console.log('merged away:        %d', merges);
  console.log('created:            %d', creates);
  console.log('deactivated:        %d', deactivations);
  console.log('placements moved:   %d', movedPlacements);

  if (apply) {
    const active = await prisma.class.count({ where: { isActive: true, deletedAt: null } });
    const orphaned = await prisma.placement.count({ where: { classId: null } });
    console.log('\nactive classes now: %d (ladder is %d)', active, LADDER.length);
    console.log('placements with no class: %d', orphaned);
  } else {
    console.log('\nRe-run with --apply to write these changes.');
    console.log('Take a database backup first.');
  }
}

main()
  .catch((error) => { console.error('Consolidation failed:', error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
