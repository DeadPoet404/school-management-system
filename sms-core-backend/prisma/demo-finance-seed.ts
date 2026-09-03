// ───────────────────────────────────────────────────────────────────────────
// DEMO finance-history seed — run against the EMPTY demo database AFTER the
// base seed (`prisma/seed.ts`) has created the org (classes, placements,
// students, staff, teachers).
//
// It does NOT create schools/people — it only makes the finance module look
// lived-in for investor demos:
//   • per-student invoices with realistic paid / partial / unpaid states,
//   • daily payment collections spread over the last ~6 months,
//   • operating expenses over the last ~6 months,
//   • payroll records for every staff + teacher,
//   • a few ledger accounts (chart of accounts),
//   • billing-ledger balances + payment receipts per student.
//
// Written against the REAL Prisma models:
//   - PaymentCollection.sectionId  references Class.id (a class "section")
//   - LedgerAccount uses debit/credit columns (code is the @id)
//   - StaffPayroll / TeacherPayroll use salaryStatus (PayrollStatus) + have
//     unique staffId/teacherId and required clearanceTier
//   - Invoice needs a unique invoiceNo
//   - Student has studentName; BillingLedger.studentId is unique
//
// ── Recommended invocation (from sms-core-backend) ─────────────────────────
//   DATABASE_URL=<demo-DIRECT-5432> NODE_ENV=development \
//     npx ts-node -r tsconfig-paths/register prisma/demo-finance-seed.ts
// ───────────────────────────────────────────────────────────────────────────
import { ExpenseStatus, InvoiceStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function fmt(n: number) {
  return n.toFixed(2);
}
// deterministic per-run serials for unique invoiceNo / receiptNumber.
let invCounter = 0;
let recCounter = 0;
function nextInvoiceNo() {
  invCounter += 1;
  return `DM-INV-${String(invCounter).padStart(5, "0")}`;
}
function nextReceiptNo() {
  recCounter += 1;
  return `DM-REC-${String(recCounter).padStart(5, "0")}`;
}

const AMOUNT = 2160;
const PAYMENT_METHODS = ["Mobile Money", "Bank Transfer", "Cash", "Card / POS", "Cheque"];
const EXPENSE_CATEGORIES = ["Utilities", "Maintenance", "Supplies", "Equipment", "Logistics"];
const EXPENSE_VENDORS = [
  "Accra Water Company",
  "ECG Power Distribution",
  "Horizon IT Supplies Ltd",
  "Classroom Furniture Co.",
  "Campus Security Services",
  "Lab Equipment Traders",
  "Book Distributors GH",
  "Transport & Logistics Services",
];
const ALLOCATION_TARGETS = [
  "Tuition & Core Academic",
  "Laboratory & IT Infrastructure",
  "Medical & Health Services",
  "Sports & Extra-Curricular",
  "Library & Resource Center",
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DEMO SEED PRODUCTION GUARD: cannot run in production.");
  }

  const [students, staff, teachers, classes] = await Promise.all([
    prisma.student.findMany({ select: { id: true, studentName: true } }),
    prisma.staff.findMany({ select: { id: true } }),
    prisma.teacher.findMany({ select: { id: true } }),
    prisma.class.findMany({ select: { id: true, name: true } }),
  ]);

  if (students.length === 0 || classes.length === 0) {
    throw new Error(
      "DEMO SEED: no students/classes found. Run the base seed first (npm run seed) on an empty DB.",
    );
  }
  const existing = await prisma.invoice.count();
  if (existing > 0 && process.env.FORCE !== "true") {
    throw new Error(
      "DEMO SEED SAFETY GUARD: finance data already exists. Use FORCE=true to erase & reseed.",
    );
  }

  const classIds = classes.map((c) => c.id);
  const payPeriod = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  console.log(
    `Demo finance seed: ${students.length} students, ${staff.length} staff, ${teachers.length} teachers, ${classes.length} classes.`,
  );

  // ── 1) Invoices per student (realistic mix) ──
  const invoiceRows = [];
  const issueBase = Date.now() - 40 * 24 * 60 * 60 * 1000;
  for (const student of students) {
    const total = AMOUNT;
    const roll = Math.random();
    let paid = total;
    let status: InvoiceStatus = "PAID";
    if (roll > 0.78) {
      paid = Math.round(total * (rand(30, 70) / 100));
      status = "PARTIAL";
    } else if (roll > 0.6) {
      paid = 0;
      status = "UNPAID";
    }
    invoiceRows.push({
      invoiceNo: nextInvoiceNo(),
      studentId: student.id,
      description: "Term Fees",
      amount: fmt(total),
      paidAmount: fmt(paid),
      status,
      dueDate: new Date(issueBase + 45 * 24 * 60 * 60 * 1000),
      createdAt: new Date(issueBase),
    });
  }

  // ── 2) Collections over ~180 days (valid Class.id as sectionId) ──
  const collections = [];
  const startCol = Date.now() - 180 * 24 * 60 * 60 * 1000;
  for (const student of students) {
    const count = rand(1, 3);
    for (let c = 0; c < count; c++) {
      const when = new Date(startCol + Math.random() * (Date.now() - startCol));
      collections.push({
        receiptNumber: nextReceiptNo(),
        sectionId: classIds[rand(0, classIds.length - 1)],
        studentName: student.studentName,
        amountPaid: fmt(rand(50, AMOUNT)),
        paymentMethod: PAYMENT_METHODS[rand(0, PAYMENT_METHODS.length - 1)],
        referenceNo: `DM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        allocationTarget: ALLOCATION_TARGETS[rand(0, ALLOCATION_TARGETS.length - 1)],
        dateProcessed: when,
      });
    }
  }

  // ── 3) Expenses over ~180 days ──
  const expenses = [];
  for (let i = 0; i < 90; i++) {
    const when = new Date(startCol + Math.random() * (Date.now() - startCol));
    expenses.push({
      expenseNo: `DM-EXP-${String(i + 1).padStart(4, "0")}`,
      vendorName: EXPENSE_VENDORS[rand(0, EXPENSE_VENDORS.length - 1)],
      category: EXPENSE_CATEGORIES[rand(0, EXPENSE_CATEGORIES.length - 1)],
      description: `Demo ${EXPENSE_CATEGORIES[rand(0, EXPENSE_CATEGORIES.length - 1)]} spend`,
      amount: fmt(rand(80, 4000)),
      paymentMethod: PAYMENT_METHODS[rand(0, PAYMENT_METHODS.length - 1)],
      status: Math.random() > 0.12 ? ("CLEARED" as ExpenseStatus) : ("PENDING_APPROVAL" as ExpenseStatus),
      expenseDate: when,
    });
  }

  // ── 4) Payroll for every staff + teacher (correct model fields) ──
  const baseSalaries = [1800, 2400, 3000, 3600, 4200, 5400];
  const pickBaseSalary = () =>
    baseSalaries[rand(0, baseSalaries.length - 1)] ?? 1800;
  const staffPayroll = staff.map((member) => {
    const base = pickBaseSalary();
    const ded = rand(0, 300);
    return {
      staffId: member.id,
      clearanceTier: "STANDARD",
      baseSalary: fmt(base),
      deductions: fmt(ded),
      netPay: fmt(base - ded),
      paymentRoute: "BANK_TRANSFER",
      salaryStatus: (Math.random() > 0.08 ? "DISBURSED" : "PENDING") as "DISBURSED" | "PENDING",
    };
  });
  const teacherPayroll = teachers.map((t) => {
    const base = pickBaseSalary();
    const ded = rand(0, 300);
    return {
      teacherId: t.id,
      clearanceTier: "STANDARD",
      baseSalary: fmt(base),
      deductions: fmt(ded),
      netPay: fmt(base - ded),
      paymentRoute: "BANK_TRANSFER",
      salaryStatus: (Math.random() > 0.08 ? "DISBURSED" : "PENDING") as "DISBURSED" | "PENDING",
    };
  });

  // ── 5) Chart of accounts (debit/credit fields) ──
  const ledgers = [
    { code: "1000", accountName: "Cash & Bank", category: "ASSET", debit: "0", credit: "0" },
    { code: "2000", accountName: "Accounts Payable", category: "LIABILITY", debit: "0", credit: "0" },
    { code: "3000", accountName: "Accounts Receivable", category: "ASSET", debit: "0", credit: "0" },
    { code: "4000", accountName: "Tuition Revenue", category: "REVENUE", debit: "0", credit: "0" },
    { code: "5000", accountName: "Operating Expenses", category: "EXPENSE", debit: "0", credit: "0" },
    { code: "6000", accountName: "Payroll Expense", category: "EXPENSE", debit: "0", credit: "0" },
  ];

  console.log("Writing demo finance records…");
  await prisma.$transaction([
    prisma.invoice.createMany({ data: invoiceRows as any }),
    prisma.paymentCollection.createMany({ data: collections as any }),
    prisma.expense.createMany({ data: expenses as any }),
    prisma.staffPayroll.createMany({ data: staffPayroll as any, skipDuplicates: true }),
    prisma.teacherPayroll.createMany({ data: teacherPayroll as any, skipDuplicates: true }),
  ]);
  for (const ledger of ledgers) {
    await prisma.ledgerAccount.upsert({
      where: { code: ledger.code },
      update: {},
      create: ledger as any,
    });
  }

  // ── 6) Billing balances + payment receipts per student ──
  for (const student of students) {
    const inv = invoiceRows.find((row: any) => row.studentId === student.id);
    const outstanding = inv ? Math.max(Number(inv.amount) - Number(inv.paidAmount), 0) : 0;
    await prisma.billingLedger.upsert({
      where: { studentId: student.id },
      update: { currentBalance: fmt(outstanding) },
      create: { studentId: student.id, initialDeposit: "0", currentBalance: fmt(outstanding) } as any,
    });
    // Also a Payment row (receipt) mirroring collections for the student.
    const studentCollection = collections.find(
      (row: any) => row.studentName === student.studentName,
    );
    if (studentCollection) {
      await prisma.payment.upsert({
        where: { receiptNo: studentCollection.receiptNumber },
        update: {},
        create: {
          receiptNo: studentCollection.receiptNumber,
          studentId: student.id,
          description: `${studentCollection.allocationTarget} - ${studentCollection.paymentMethod}`,
          amount: studentCollection.amountPaid,
          paymentType: studentCollection.paymentMethod,
        } as any,
      });
    }
  }

  console.log("✓ Demo finance seed complete.");
  console.log(
    `  Invoices: ${invoiceRows.length} · Collections: ${collections.length} · Expenses: ${expenses.length} · StaffPayroll: ${staffPayroll.length} · TeacherPayroll: ${teacherPayroll.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
