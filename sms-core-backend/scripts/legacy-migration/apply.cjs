#!/usr/bin/env node
/**
 * Eskooly legacy migration runner (Jocomfy SMS).
 *
 * Applies the machine plan produced by migration/build-plan.py:
 *   1. structure  — create missing classes, per-class fee tiers, per-class fee structures
 *   2. existing   — for the matched existing students: class move, FIRST TERM invoice,
 *                   consolidated payment, ledger balance (carry-over included)
 *   3. new        — for students enrolled via the standard import (matched by legacyStudentId):
 *                   same financial steps
 *
 * Usage (inside the backend container, where @prisma/client + DATABASE_URL exist):
 *   node apply.cjs --plan /app/migration-plan.json --dry-run
 *   node apply.cjs --plan /app/migration-plan.json
 *   node apply.cjs --plan /app/migration-plan.json --only new        # after the UI import
 *   node apply.cjs --plan /app/migration-plan.json --expect-sha <sha256 of the plan file>
 *
 * Safety properties:
 *   - NO interactive prisma.$transaction (Supabase PgBouncer rejects them).
 *   - Idempotent: invoices/payments carry the description marker LEGACY-ESKOOLY-FT2627;
 *     re-runs skip already-migrated students but still re-sync ledgers (absolute values).
 *   - Class moves only fire when the student is still in the documented "from" class.
 *   - Writes an AuditLog entry (action LEGACY_MIGRATION) with planHash + counts.
 *   - Refuses to run if --expect-sha is given and does not match the plan file.
 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient, Prisma } = require('@prisma/client');

const MARKER = 'LEGACY-ESKOOLY-FT2627';
const INVOICE_DESC = `${MARKER} | FIRST TERM 2026/27 invoice`;
const PAYMENT_DESC = `${MARKER} | FIRST TERM 2026/27 payment`;

function parseArgs(argv) {
  const args = { plan: null, dryRun: false, only: 'all', expectSha: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') args.plan = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--expect-sha') args.expectSha = argv[++i];
    else { console.error(`Unknown arg: ${a}`); process.exit(2); }
  }
  if (!args.plan) { console.error('Missing --plan <file>'); process.exit(2); }
  if (!['all', 'structure', 'existing', 'new'].includes(args.only)) {
    console.error('--only must be one of: all, structure, existing, new'); process.exit(2);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

// ── load + verify plan ──────────────────────────────────────────────────────
const planBytes = fs.readFileSync(args.plan);
const sha = crypto.createHash('sha256').update(planBytes).digest('hex');
if (args.expectSha && sha !== args.expectSha) {
  console.error(`PLAN FILE MISMATCH: sha256 ${sha} != expected ${args.expectSha}. Aborting.`);
  process.exit(3);
}
const plan = JSON.parse(planBytes.toString('utf8'));
console.log(`plan: ${args.plan}`);
console.log(`planHash=${plan.planHash} fileSha256=${sha}`);
console.log(`mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'} only=${args.only}`);

const prisma = new PrismaClient();

const stats = {
  classesCreated: 0, classesSkipped: 0,
  tiersCreated: 0, tiersSkipped: 0,
  structuresCreated: 0, structuresSkipped: 0,
  movesApplied: 0, movesSkipped: 0, movesBlocked: 0,
  studentsMigrated: 0, studentsSkipped: 0, studentsPending: 0, studentsFailed: 0,
  invoicesCreated: 0, paymentsCreated: 0, ledgersSet: 0,
  invoiceSum: 0, paymentSum: 0, balanceSum: 0,
  failures: [],
};

const dec = (n) => Number(n);

function say(...x) { console.log(...x); }
function fail(student, err) {
  stats.studentsFailed += 1;
  stats.failures.push(`${student}: ${err && err.message ? err.message : err}`);
}

// ── 1. structure ────────────────────────────────────────────────────────────
async function applyStructure() {
  const classIds = {};
  for (const c of plan.createClasses || []) {
    const found = await prisma.class.findUnique({ where: { name: c.name } });
    if (found) { classIds[c.name] = found.id; stats.classesSkipped++; continue; }
    if (args.dryRun) { say(`[dry] create class ${c.name} (${c.section})`); stats.classesCreated++; continue; }
    const created = await prisma.class.create({ data: { name: c.name, section: c.section, isActive: true } });
    classIds[c.name] = created.id; stats.classesCreated++;
    say(`created class ${c.name} (${c.section})`);
  }
  // resolve ids for all classes we need
  const needed = new Set([...(plan.createClasses || []).map((c) => c.name),
    ...(plan.createFeeTiers || []).map((t) => t.className),
    ...(plan.createFeeStructures || []).map((s) => s.className)]);
  for (const name of needed) {
    if (classIds[name]) continue;
    const found = await prisma.class.findUnique({ where: { name } });
    if (!found) throw new Error(`Class not found and not in createClasses: ${name}`);
    classIds[name] = found.id;
  }

  const tierIds = {};
  for (const t of plan.createFeeTiers || []) {
    const found = await prisma.feeTier.findUnique({ where: { code: t.code } });
    if (found) { tierIds[t.className] = found.id; stats.tiersSkipped++; continue; }
    if (args.dryRun) { say(`[dry] create fee tier ${t.code} ${t.amount}`); stats.tiersCreated++; continue; }
    const created = await prisma.feeTier.create({
      data: { name: t.name, code: t.code, amount: new Prisma.Decimal(t.amount), isActive: true },
    });
    tierIds[t.className] = created.id; stats.tiersCreated++;
    say(`created fee tier ${t.code} (GH${t.amount})`);
  }
  for (const t of plan.createFeeTiers || []) {
    if (tierIds[t.className]) continue;
    const found = await prisma.feeTier.findUnique({ where: { code: t.code } });
    if (found) tierIds[t.className] = found.id;
  }

  for (const s of plan.createFeeStructures || []) {
    const classId = classIds[s.className];
    const existing = await prisma.feeStructureConfiguration.findUnique({ where: { sectionId: classId } });
    if (existing) { stats.structuresSkipped++; continue; }
    if (args.dryRun) { say(`[dry] create fee structure for ${s.className}`); stats.structuresCreated++; continue; }
    await prisma.feeStructureConfiguration.create({
      data: {
        sectionId: classId,
        issueDate: new Date(s.issueDate),
        dueDate: new Date(s.dueDate),
        allowInstallments: true,
        lateFeeRate: new Prisma.Decimal(0),
        components: { create: s.components.map((c) => ({ name: c.name, amount: new Prisma.Decimal(c.amount), frequency: c.frequency, isMandatory: !!c.isMandatory })) },
      },
    });
    stats.structuresCreated++;
    say(`created fee structure for ${s.className}`);
  }
  return { classIds, tierIds };
}

// ── per-student financial migration ─────────────────────────────────────────
async function migrateStudent(entry, seq, legacyIdForLog) {
  const student = await prisma.student.findUnique({
    where: { id: entry.studentId },
    include: { placement: true, billing: true },
  });
  if (!student) { fail(entry.studentName || legacyIdForLog, 'student row not found'); return; }

  // idempotency: already-migrated marker?
  const existingInvoice = await prisma.invoice.findFirst({
    where: { studentId: student.id, description: { startsWith: MARKER } },
    select: { id: true },
  });
  const already = !!existingInvoice;

  let moved = false;
  if (!args.dryRun && entry.classMove && !already) {
    const fromClass = await prisma.class.findUnique({ where: { name: entry.classMove.from } });
    const toClass = await prisma.class.findUnique({ where: { name: entry.classMove.to } });
    if (!fromClass || !toClass) { fail(entry.studentName, `class missing for move ${entry.classMove.from} -> ${entry.classMove.to}`); return; }
    if (student.placement && student.placement.classId === toClass.id) {
      stats.movesSkipped++; // already there (re-run)
    } else if (student.placement && student.placement.classId === fromClass.id) {
      await prisma.placement.update({ where: { id: student.placement.id }, data: { classId: toClass.id } });
      stats.movesApplied++; moved = true;
    } else {
      stats.movesBlocked++;
      say(`! class move blocked for ${entry.studentName}: currently not in ${entry.classMove.from}`);
    }
  } else if (entry.classMove && !already) {
    stats.movesSkipped++;
  }

  let paidApplied = 0;
  if (entry.invoice && !already) {
    const pay = entry.payment ? entry.payment.amount : 0;
    const amount = entry.invoice.amount;
    const paid = Math.min(pay, amount);
    if (!args.dryRun) {
      await prisma.invoice.create({
        data: {
          invoiceNo: `INV-LGY-${String(seq).padStart(4, '0')}`,
          studentId: student.id,
          description: INVOICE_DESC,
          amount: new Prisma.Decimal(amount),
          paidAmount: new Prisma.Decimal(paid),
          status: paid >= amount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
          dueDate: new Date(entry.invoice.dueDate),
        },
      });
    }
    stats.invoicesCreated++; stats.invoiceSum += amount; paidApplied = paid;
  }
  if (entry.payment && !already) {
    if (!args.dryRun) {
      await prisma.payment.create({
        data: {
          receiptNo: `REC-LGY-${String(seq).padStart(4, '0')}`,
          studentId: student.id,
          description: PAYMENT_DESC,
          amount: new Prisma.Decimal(entry.payment.amount),
          paymentType: 'Cash',
          createdAt: new Date(entry.payment.date),
        },
      });
    }
    stats.paymentsCreated++; stats.paymentSum += entry.payment.amount;
  }

  // ledger sync — ALWAYS (absolute value, safe to repeat)
  const target = Number(entry.finalBalance);
  if (!args.dryRun) {
    await prisma.billingLedger.upsert({
      where: { studentId: student.id },
      update: { currentBalance: new Prisma.Decimal(target) },
      create: { studentId: student.id, currentBalance: new Prisma.Decimal(target), initialDeposit: new Prisma.Decimal(0) },
    });
  }
  stats.ledgersSet++; stats.balanceSum += target;

  if (already) { stats.studentsSkipped++; }
  else { stats.studentsMigrated++; }
  if (moved && !args.dryRun) say(`moved ${entry.studentName}: ${entry.classMove.from} -> ${entry.classMove.to}`);
}

// ── run ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    let ids = {};
    if (args.only === 'all' || args.only === 'structure') {
      say('── structure ──');
      ids = await applyStructure();
    }

    if (args.only === 'all' || args.only === 'existing') {
      say(`── existing cohort (${plan.assignments.length}) ──`);
      for (let k = 0; k < plan.assignments.length; k++) {
        const a = plan.assignments[k];
        try {
          await migrateStudent(a, k + 1, a.eskoolyRegNo);
        } catch (err) { fail(`${a.studentName} (${a.eskoolyRegNo})`, err); }
      }
    }

    if (args.only === 'all' || args.only === 'new') {
      say(`── new-student cohort (${plan.newStudentFinancials.length}) ──`);
      const normReg = (raw) => {
        if (!raw) return null;
        const digits = String(raw).toUpperCase().replace('JSC', 'JCS').replace(/[^0-9]/g, '');
        return digits ? `JCS-${digits.padStart(4, '0')}` : null;
      };
      const allWithLegacy = await prisma.student.findMany({
        where: { legacyStudentId: { not: null } },
        select: { id: true, legacyStudentId: true },
      });
      const byNorm = new Map();
      for (const st of allWithLegacy) byNorm.set(normReg(st.legacyStudentId), st.id);
      const entries = [];
      for (const e of plan.newStudentFinancials) {
        const id = byNorm.get(e.legacyStudentId);
        if (!id) { stats.studentsPending++; say(`pending import: ${e.legacyStudentId} ${e.import ? e.import.fullName : ''}`); continue; }
        entries.push({ studentId: id, studentName: e.import ? e.import.fullName : e.legacyStudentId,
          classMove: null, invoice: e.invoice, payment: e.payment, finalBalance: e.finalBalance });
      }
      for (let k = 0; k < entries.length; k++) {
        try {
          // reuse the plan seq space so receipts stay stable across cohorts
          await migrateStudent(entries[k], plan.assignments.length + k + 1, plan.newStudentFinancials[k].legacyStudentId);
        } catch (err) { fail(`${plan.newStudentFinancials[k].legacyStudentId}`, err); }
      }
    }

    if (!args.dryRun && (args.only === 'all' || args.only === 'existing' || args.only === 'new')) {
      const exp = plan.expected || {};
      say('── audit ──');
      await prisma.auditLog.create({
        data: {
          requestId: `legacy-migration-${plan.planHash}`,
          actorId: 'system-legacy-migration',
          actorEmail: 'system@jocomfy.com',
          actorRole: 'ADMIN',
          action: 'LEGACY_MIGRATION',
          method: 'SCRIPT',
          path: '/legacy-migration',
          requestBody: {
            planHash: plan.planHash,
            fileSha256: sha,
            mode: 'apply',
            only: args.only,
            migrated: stats.studentsMigrated,
            skippedAlready: stats.studentsSkipped,
            pendingImport: stats.studentsPending,
            failed: stats.failures,
            classesCreated: stats.classesCreated, tiersCreated: stats.tiersCreated, structuresCreated: stats.structuresCreated,
            movesApplied: stats.movesApplied,
            invoicesCreated: stats.invoicesCreated, paymentsCreated: stats.paymentsCreated, ledgersSet: stats.ledgersSet,
            sums: { invoice: stats.invoiceSum, payment: stats.paymentSum, finalBalance: stats.balanceSum },
            expected: exp,
          },
          responseStatus: 200,
          ipAddress: '127.0.0.1',
        },
      });
      say('audit log written (action=LEGACY_MIGRATION)');
    }

    // ── reconciliation report ──
    say('════ RUN SUMMARY ════');
    say(`classes: created ${stats.classesCreated}, skipped ${stats.classesSkipped}`);
    say(`fee tiers: created ${stats.tiersCreated}, skipped ${stats.tiersSkipped}`);
    say(`fee structures: created ${stats.structuresCreated}, skipped ${stats.structuresSkipped}`);
    say(`class moves: applied ${stats.movesApplied}, already-there/skipped ${stats.movesSkipped}, blocked ${stats.movesBlocked}`);
    say(`students: migrated ${stats.studentsMigrated}, skipped(already) ${stats.studentsSkipped}, pending import ${stats.studentsPending}, FAILED ${stats.studentsFailed}`);
    say(`invoices created: ${stats.invoicesCreated} (sum GH${stats.invoiceSum.toFixed(2)})`);
    say(`payments created: ${stats.paymentsCreated} (sum GH${stats.paymentSum.toFixed(2)})`);
    say(`ledgers set: ${stats.ledgersSet} (sum GH${stats.balanceSum.toFixed(2)})`);
    const exp = plan.expected || {};
    if (stats.studentsFailed > 0) {
      say('── FAILURES ──');
      stats.failures.forEach((f) => say('  ! ' + f));
    }
    if (!args.dryRun && args.only === 'all') {
      const payDelta = (exp.totalPayment || 0) - (stats.paymentSum + (stats.studentsSkipped > 0 ? 0 : 0));
      say(`expected vs actual (this run): payment ${exp.totalPayment} vs ${stats.paymentSum} (delta ${payDelta.toFixed(2)} — includes students already migrated in earlier runs)`);
      say(`expected final balances: ${exp.totalFinalBalance} vs ${stats.balanceSum}`);
    }
    if (stats.studentsFailed > 0) process.exitCode = 1;
    else say(args.dryRun ? 'DRY-RUN complete — no writes made.' : 'APPLY complete.');
  } finally {
    await prisma.$disconnect();
  }
})().catch((err) => { console.error('FATAL:', err); process.exit(4); });
