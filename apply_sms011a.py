#!/usr/bin/env python3
"""SMS-011: nine granular dashboard analytics endpoints.

Edits (all anchors verified byte-exact against the reference clone; the
analytics module was untouched by patches 001-010):
  src/modules/analytics/analytics.service.ts    -- += helpers (clampMonths,
      clampLimit, monthWindow, parseYmd, entityFromPath) + 9 service methods
  src/modules/analytics/analytics.controller.ts -- += parseQueryInt + 9 handlers
  src/modules/analytics/analytics.routes.ts     -- += 9 GET routes behind the
      existing dashboardAccess guard (ADMIN, ACCOUNTANT, STAFF)

Creates:
  docs/DASHBOARD_DATA_API.md                    -- design-phase data contract
  src/__tests__/unit/services/analytics.service.test.ts -- 14 tests
      (aggregation correctness per endpoint + role matrix for the guard)

Ratified decisions: expense spend = CLEARED only (PENDING_APPROVAL reported as
meta); monthly window default 12 (clamp 3-24); present = PRESENT|LATE (inherits
the incumbent /dashboard convention); pass = letterGrade != 'F9'.

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms011a.py
"""
from pathlib import Path

BACKEND = Path("sms-core-backend")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def edit(path: Path, old: str, new: str, label: str, skip_marker: str) -> str:
    if not path.is_file():
        raise SystemExit(f"ABORT: {path} not found. Run from ~/sms-monorepo.")
    c = path.read_text(encoding="utf-8")
    if skip_marker in c:
        print(f"SKIP: {path} already patched ({label}).")
        return c
    out = replace_once(c, old, new, label)
    print(f"OK: {path}  ({label})")
    return out


def create(path: Path, body: str) -> None:
    if path.exists():
        raise SystemExit(f"ABORT: {path} already exists. Refusing to overwrite.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    print(f"OK: created {path}")


SERVICE_HELPERS = '''function clampMonths(months: number | undefined): number {
  if (!months || !Number.isFinite(months)) return 12;
  return Math.min(Math.max(Math.floor(months), 3), 24);
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.floor(limit), 1), max);
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Ascending first-of-month UTC dates covering the current month and (months - 1) back. */
function monthWindow(months: number): Date[] {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  return Array.from({ length: months }, (_, index) => {
    const d = new Date(first);
    d.setUTCMonth(first.getUTCMonth() + index);
    return d;
  });
}

/** Strict YYYY-MM-DD (UTC) parser; anything else returns null (caller falls back to today). */
function parseYmd(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** '/api/students/123' -> 'students'; '/health' -> 'health'. */
function entityFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[1] ?? segments[0] ?? 'root';
}

'''

SERVICE_METHODS = '''
  // ── SMS-011: granular per-widget aggregations (docs/DASHBOARD_DATA_API.md) ──

  /** Cash vs MoMo/card/bank split + monthly trend. */
  async getCollectionsByChannel(monthsInput?: number) {
    const months = clampMonths(monthsInput);
    const windowStarts = monthWindow(months);
    const windowStart = windowStarts[0]!;

    const rows = await prisma.paymentCollection.findMany({
      where: { deletedAt: null, dateProcessed: { gte: windowStart } },
      select: { amountPaid: true, paymentMethod: true, dateProcessed: true },
    });

    const channels = new Map<string, { total: number; count: number }>();
    const monthly = new Map<string, { total: number; byChannel: Map<string, number> }>();
    for (const start of windowStarts) {
      monthly.set(monthKey(start), { total: 0, byChannel: new Map() });
    }

    for (const row of rows) {
      const amount = toNumber(row.amountPaid);
      const channel = row.paymentMethod || 'UNKNOWN';
      const bucket = channels.get(channel) ?? { total: 0, count: 0 };
      bucket.total += amount;
      bucket.count += 1;
      channels.set(channel, bucket);

      const month = monthly.get(monthKey(row.dateProcessed));
      if (month) {
        month.total += amount;
        month.byChannel.set(channel, (month.byChannel.get(channel) ?? 0) + amount);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      window: {
        months,
        startMonth: monthKey(windowStart),
        endMonth: monthKey(windowStarts[windowStarts.length - 1]!),
      },
      channels: [...channels.entries()]
        .map(([channel, v]) => ({ channel, total: roundCurrency(v.total), count: v.count }))
        .sort((a, b) => b.total - a.total),
      monthly: [...monthly.entries()].map(([month, m]) => {
        const byChannel: Record<string, number> = {};
        for (const [k, v] of m.byChannel) byChannel[k] = roundCurrency(v);
        return { month, total: roundCurrency(m.total), byChannel };
      }),
    };
  }

  /** Cleared expenses by category + monthly series + revenue-vs-expense net position. */
  async getExpenseBreakdown(monthsInput?: number) {
    const months = clampMonths(monthsInput);
    const windowStarts = monthWindow(months);
    const windowStart = windowStarts[0]!;

    const [expenseRows, pendingAggregate, collectionRows] = await prisma.$transaction([
      prisma.expense.findMany({
        where: { deletedAt: null, status: 'CLEARED', expenseDate: { gte: windowStart } },
        select: { amount: true, category: true, expenseDate: true },
      }),
      prisma.expense.aggregate({
        where: { deletedAt: null, status: 'PENDING_APPROVAL' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.paymentCollection.findMany({
        where: { deletedAt: null, dateProcessed: { gte: windowStart } },
        select: { amountPaid: true, dateProcessed: true },
      }),
    ]);

    const categories = new Map<string, { total: number; count: number }>();
    const monthly = new Map<string, { expenses: number; collections: number }>();
    for (const start of windowStarts) {
      monthly.set(monthKey(start), { expenses: 0, collections: 0 });
    }

    for (const row of expenseRows) {
      const amount = toNumber(row.amount);
      const category = row.category || 'UNCATEGORIZED';
      const bucket = categories.get(category) ?? { total: 0, count: 0 };
      bucket.total += amount;
      bucket.count += 1;
      categories.set(category, bucket);
      const month = monthly.get(monthKey(row.expenseDate));
      if (month) month.expenses += amount;
    }
    for (const row of collectionRows) {
      const month = monthly.get(monthKey(row.dateProcessed));
      if (month) month.collections += toNumber(row.amountPaid);
    }

    return {
      generatedAt: new Date().toISOString(),
      window: {
        months,
        startMonth: monthKey(windowStart),
        endMonth: monthKey(windowStarts[windowStarts.length - 1]!),
      },
      spendBasis: 'CLEARED',
      categories: [...categories.entries()]
        .map(([category, v]) => ({ category, total: roundCurrency(v.total), count: v.count }))
        .sort((a, b) => b.total - a.total),
      monthly: [...monthly.entries()].map(([month, m]) => ({
        month,
        expenses: roundCurrency(m.expenses),
      })),
      pendingApproval: {
        total: roundCurrency(toNumber(pendingAggregate._sum.amount)),
        count: pendingAggregate._count._all,
      },
      netPosition: [...monthly.entries()].map(([month, m]) => ({
        month,
        collections: roundCurrency(m.collections),
        expenses: roundCurrency(m.expenses),
        net: roundCurrency(m.collections - m.expenses),
      })),
    };
  }

  /** current / 1-30 / 31-60 / 60+ day buckets (invoice dueDate vs paidAmount). */
  async getReceivablesAging() {
    const today = startOfUtcDay(new Date());
    const rows = await prisma.invoice.findMany({
      where: { deletedAt: null, status: { in: ['UNPAID', 'PARTIAL'] } },
      select: { amount: true, paidAmount: true, dueDate: true },
    });

    const fresh = () => ({ count: 0, amount: 0 });
    const buckets = { current: fresh(), days1to30: fresh(), days31to60: fresh(), over60: fresh() };
    let totalOutstanding = 0;

    for (const row of rows) {
      const outstanding = toNumber(row.amount) - toNumber(row.paidAmount);
      if (outstanding <= 0) continue;
      const overdueDays = Math.floor(
        (today.getTime() - startOfUtcDay(row.dueDate).getTime()) / 86400000,
      );
      const bucket =
        overdueDays <= 0
          ? buckets.current
          : overdueDays <= 30
            ? buckets.days1to30
            : overdueDays <= 60
              ? buckets.days31to60
              : buckets.over60;
      bucket.count += 1;
      bucket.amount += outstanding;
      totalOutstanding += outstanding;
    }

    return {
      asOf: toDateKey(today),
      totalOutstanding: roundCurrency(totalOutstanding),
      buckets: {
        current: { count: buckets.current.count, amount: roundCurrency(buckets.current.amount) },
        days1to30: { count: buckets.days1to30.count, amount: roundCurrency(buckets.days1to30.amount) },
        days31to60: { count: buckets.days31to60.count, amount: roundCurrency(buckets.days31to60.amount) },
        over60: { count: buckets.over60.count, amount: roundCurrency(buckets.over60.amount) },
      },
    };
  }

  /** Attendance rate per class (day or trailing-7 week) via Placement join. */
  async getAttendanceByClass(options: { date?: string; range?: string }) {
    const target = parseYmd(options.date) ?? startOfUtcDay(new Date());
    const isWeek = options.range === 'week';
    const windowStart = startOfUtcDay(new Date(target));
    if (isWeek) windowStart.setUTCDate(windowStart.getUTCDate() - 6);

    const rows = await prisma.attendanceRecord.findMany({
      where: { date: { gte: windowStart, lte: target } },
      select: {
        status: true,
        student: {
          select: {
            placement: { select: { class: { select: { id: true, name: true, deletedAt: true } } } },
          },
        },
      },
    });

    const classes = new Map<string, { className: string; present: number; total: number }>();
    let skippedUnassigned = 0;
    for (const row of rows) {
      const cls = row.student.placement?.class;
      if (!cls || cls.deletedAt) {
        skippedUnassigned += 1;
        continue;
      }
      const bucket = classes.get(cls.id) ?? { className: cls.name, present: 0, total: 0 };
      bucket.total += 1;
      if (row.status === 'PRESENT' || row.status === 'LATE') bucket.present += 1;
      classes.set(cls.id, bucket);
    }

    return {
      generatedAt: new Date().toISOString(),
      date: toDateKey(target),
      range: isWeek ? 'week' : 'day',
      windowStart: toDateKey(windowStart),
      classes: [...classes.entries()]
        .map(([classId, v]) => ({
          classId,
          className: v.className,
          present: v.present,
          total: v.total,
          ratePct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        }))
        .sort((a, b) => a.className.localeCompare(b.className)),
      skippedUnassigned,
    };
  }

  /** Students per class + gender split (Demographics); ACTIVE students only. */
  async getEnrollmentDistribution() {
    const rows = await prisma.placement.findMany({
      where: { student: { status: 'ACTIVE' } },
      select: {
        classId: true,
        class: { select: { name: true, deletedAt: true } },
        student: { select: { demographics: { select: { gender: true } } } },
      },
    });

    const classes = new Map<
      string,
      { classId: string | null; className: string; students: number; male: number; female: number; other: number }
    >();
    let total = 0;

    for (const row of rows) {
      const usable = row.classId && row.class && !row.class.deletedAt;
      const key = usable ? (row.classId as string) : '__unassigned__';
      const bucket =
        classes.get(key) ?? {
          classId: usable ? (row.classId as string) : null,
          className: usable ? (row.class as { name: string }).name : 'Unassigned',
          students: 0,
          male: 0,
          female: 0,
          other: 0,
        };
      bucket.students += 1;
      total += 1;
      const gender = (row.student.demographics?.gender ?? '').toLowerCase();
      if (gender === 'male') bucket.male += 1;
      else if (gender === 'female') bucket.female += 1;
      else bucket.other += 1;
      classes.set(key, bucket);
    }

    const unassigned = classes.get('__unassigned__');
    classes.delete('__unassigned__');
    const list = [...classes.values()].sort(
      (a, b) => b.students - a.students || a.className.localeCompare(b.className),
    );
    if (unassigned) list.push(unassigned);

    return { generatedAt: new Date().toISOString(), total, classes: list };
  }

  /** School avg GPA, per-class averages, per-subject pass rates, GPA distribution. */
  async getAcademicPerformance(termId?: string) {
    const [students, records] = await prisma.$transaction([
      prisma.student.findMany({ where: { status: 'ACTIVE' }, select: { currentGpa: true } }),
      prisma.gradeRecord.findMany({
        where: termId ? { termId } : {},
        select: {
          finalScore: true,
          gradePoints: true,
          letterGrade: true,
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    const gpaTotal = students.reduce((sum, s) => sum + s.currentGpa, 0);
    const distribution = [
      { bucket: '0-1', students: 0 },
      { bucket: '1-2', students: 0 },
      { bucket: '2-3', students: 0 },
      { bucket: '3-4', students: 0 },
    ];
    for (const s of students) {
      const index = Math.min(3, Math.max(0, Math.floor(s.currentGpa)));
      distribution[index]!.students += 1;
    }

    const perClass = new Map<string, { className: string; records: number; sumPoints: number; sumScore: number }>();
    const perSubject = new Map<
      string,
      { subjectName: string; code: string; records: number; pass: number }
    >();

    for (const r of records) {
      const cls = perClass.get(r.class.id) ?? {
        className: r.class.name,
        records: 0,
        sumPoints: 0,
        sumScore: 0,
      };
      cls.records += 1;
      cls.sumPoints += toNumber(r.gradePoints);
      cls.sumScore += toNumber(r.finalScore);
      perClass.set(r.class.id, cls);

      const sub = perSubject.get(r.subject.id) ?? {
        subjectName: r.subject.name,
        code: r.subject.code,
        records: 0,
        pass: 0,
      };
      sub.records += 1;
      if (r.letterGrade !== 'F9') sub.pass += 1;
      perSubject.set(r.subject.id, sub);
    }

    return {
      generatedAt: new Date().toISOString(),
      termId: termId ?? null,
      schoolAverageGpa: students.length > 0 ? roundCurrency(gpaTotal / students.length) : 0,
      activeStudents: students.length,
      perClass: [...perClass.entries()]
        .map(([classId, v]) => ({
          classId,
          className: v.className,
          records: v.records,
          averagePoints: v.records > 0 ? roundCurrency(v.sumPoints / v.records) : 0,
          averageScore: v.records > 0 ? roundCurrency(v.sumScore / v.records) : 0,
        }))
        .sort((a, b) => a.className.localeCompare(b.className)),
      perSubject: [...perSubject.entries()]
        .map(([subjectId, v]) => ({
          subjectId,
          subjectName: v.subjectName,
          code: v.code,
          records: v.records,
          passRatePct: v.records > 0 ? Math.round((v.pass / v.records) * 100) : 0,
        }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
      gpaDistribution: distribution,
    };
  }

  /** Standing monthly payroll obligation (teacher + staff) vs this month's collections. */
  async getPayrollSummary() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [teacherRows, staffRows, monthCollections] = await prisma.$transaction([
      prisma.teacherPayroll.findMany({ select: { netPay: true, salaryStatus: true } }),
      prisma.staffPayroll.findMany({ select: { netPay: true, salaryStatus: true } }),
      prisma.paymentCollection.aggregate({
        where: { deletedAt: null, dateProcessed: { gte: monthStart } },
        _sum: { amountPaid: true },
        _count: { _all: true },
      }),
    ]);

    const summarize = (rows: { netPay: unknown; salaryStatus: string }[]) => {
      const byStatus: Record<string, number> = {};
      let netPayTotal = 0;
      for (const row of rows) {
        netPayTotal += toNumber(row.netPay);
        byStatus[row.salaryStatus] = (byStatus[row.salaryStatus] ?? 0) + 1;
      }
      return { headcount: rows.length, netPayTotal: roundCurrency(netPayTotal), byStatus };
    };

    const teachers = summarize(teacherRows);
    const staff = summarize(staffRows);
    const monthlyObligation = roundCurrency(teachers.netPayTotal + staff.netPayTotal);
    const collectionsThisMonth = roundCurrency(toNumber(monthCollections._sum.amountPaid));

    return {
      generatedAt: new Date().toISOString(),
      month: monthKey(now),
      teachers,
      staff,
      monthlyObligation,
      collectionsThisMonth,
      collectionTransactions: monthCollections._count._all,
      netPosition: roundCurrency(collectionsThisMonth - monthlyObligation),
      coverageRatio: monthlyObligation > 0 ? roundCurrency(collectionsThisMonth / monthlyObligation) : null,
    };
  }

  /** Server-side top-N students by outstanding billing balance. */
  async getTopDebtors(limitInput?: number) {
    const limit = clampLimit(limitInput, 10, 50);
    const rows = await prisma.billingLedger.findMany({
      where: { currentBalance: { gt: 0 } },
      orderBy: { currentBalance: 'desc' },
      take: limit,
      select: {
        currentBalance: true,
        student: {
          select: {
            id: true,
            studentId: true,
            studentName: true,
            placement: { select: { class: { select: { name: true } } } },
          },
        },
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      limit,
      debtors: rows.map((row) => ({
        studentInternalId: row.student.id,
        studentId: row.student.studentId,
        studentName: row.student.studentName,
        className: row.student.placement?.class?.name ?? null,
        balance: roundCurrency(toNumber(row.currentBalance)),
      })),
    };
  }

  /** Recent AuditLog events (actor, action, entity, timestamp). requestBody excluded. */
  async getActivityFeed(limitInput?: number) {
    const limit = clampLimit(limitInput, 20, 100);
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        actorId: true,
        actorEmail: true,
        actorRole: true,
        action: true,
        method: true,
        path: true,
        responseStatus: true,
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      limit,
      events: rows.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        actor: { id: row.actorId, email: row.actorEmail, role: row.actorRole },
        action: row.action,
        method: row.method,
        entity: entityFromPath(row.path),
        path: row.path,
        status: row.responseStatus,
      })),
    };
  }
}
'''

CONTROLLER_HELPER = '''function parseQueryInt(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class AnalyticsController {
'''

CONTROLLER_PROPS = '''
  // ── SMS-011: granular per-widget endpoints ──

  getCollectionsByChannel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getCollectionsByChannel(parseQueryInt(req.query.months));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getExpenseBreakdown = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getExpenseBreakdown(parseQueryInt(req.query.months));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getReceivablesAging = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getReceivablesAging();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getAttendanceByClass = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getAttendanceByClass({
        date: typeof req.query.date === 'string' ? req.query.date : undefined,
        range: typeof req.query.range === 'string' ? req.query.range : undefined,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getEnrollmentDistribution = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getEnrollmentDistribution();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getAcademicPerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getAcademicPerformance(
        typeof req.query.termId === 'string' ? req.query.termId : undefined,
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getPayrollSummary = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getPayrollSummary();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getTopDebtors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getTopDebtors(parseQueryInt(req.query.limit));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getActivityFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.analyticsService.getActivityFeed(parseQueryInt(req.query.limit));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
'''

ROUTES_ADD = '''

// SMS-011: granular per-widget aggregations (docs/DASHBOARD_DATA_API.md)
router.get('/collections-by-channel', dashboardAccess, controller.getCollectionsByChannel);
router.get('/expense-breakdown', dashboardAccess, controller.getExpenseBreakdown);
router.get('/receivables-aging', dashboardAccess, controller.getReceivablesAging);
router.get('/attendance-by-class', dashboardAccess, controller.getAttendanceByClass);
router.get('/enrollment-distribution', dashboardAccess, controller.getEnrollmentDistribution);
router.get('/academic-performance', dashboardAccess, controller.getAcademicPerformance);
router.get('/payroll-summary', dashboardAccess, controller.getPayrollSummary);
router.get('/top-debtors', dashboardAccess, controller.getTopDebtors);
router.get('/activity-feed', dashboardAccess, controller.getActivityFeed);
'''

DOC = '''# Dashboard Data API (SMS-011)

Nine granular aggregation endpoints for the product-owner-owned dashboard
designs (main + finance). Each is a `GET` under `/api/analytics`, guarded by
the incumbent matrix **`requireRole(ADMIN, ACCOUNTANT, STAFF)`** (JWT cookies),
returning the standard envelope `{ "success": true, "data": <payload> }`.

## Conventions

| Convention | Detail |
|---|---|
| Money | Numbers rounded to 2dp, in the school's operating currency (GHS). |
| Months | `YYYY-MM` UTC buckets. `?months=` defaults to **12**, clamped **3–24**; every window includes the current month and is zero-filled. |
| Percentages | Whole percents (e.g. `ratePct: 75`). |
| `present` | `PRESENT` OR `LATE` (same convention as `/api/analytics/dashboard`). |
| Envelope errors | Non-allowlisted roles get `403` (plus `401` unauthenticated). |

---

## 1. `GET /api/analytics/collections-by-channel?months=`

Cash vs MoMo/card/bank split + monthly trend (source: `PaymentCollection`, soft-deletes excluded).

```json
{
  "generatedAt": "2026-08-05T09:00:00.000Z",
  "window": { "months": 12, "startMonth": "2025-09", "endMonth": "2026-08" },
  "channels": [
    { "channel": "CASH", "total": 48250.5, "count": 132 },
    { "channel": "MOBILE_MONEY", "total": 12075.0, "count": 21 }
  ],
  "monthly": [
    { "month": "2026-07", "total": 5400.0, "byChannel": { "CASH": 5400.0 } },
    { "month": "2026-08", "total": 2675.0, "byChannel": { "CASH": 1675.0, "MOBILE_MONEY": 1000.0 } }
  ]
}
```

- `channels` sorted by `total` desc; `UNKNOWN` bucket if a legacy row lacks a method.

## 2. `GET /api/analytics/expense-breakdown?months=`

Expenses by category, monthly series, revenue-vs-expense net position.
**Spend basis: `CLEARED` only.** `PENDING_APPROVAL` surfaced as meta; `REJECTED` excluded.

```json
{
  "spendBasis": "CLEARED",
  "categories": [{ "category": "UTILITIES", "total": 3200.0, "count": 8 }],
  "monthly": [{ "month": "2026-08", "expenses": 400.0 }],
  "pendingApproval": { "total": 1150.0, "count": 3 },
  "netPosition": [{ "month": "2026-08", "collections": 5400.0, "expenses": 400.0, "net": 5000.0 }]
}
```

(`generatedAt` + `window` also present, same shape as endpoint 1.)

## 3. `GET /api/analytics/receivables-aging`

Open invoices (`UNPAID`/`PARTIAL`, outstanding = `amount − paidAmount > 0`)
bucketed against **today (UTC)** by `dueDate`.

```json
{
  "asOf": "2026-08-05",
  "totalOutstanding": 1400.0,
  "buckets": {
    "current":    { "count": 1, "amount": 500.0 },
    "days1to30":  { "count": 1, "amount": 300.0 },
    "days31to60": { "count": 1, "amount": 200.0 },
    "over60":     { "count": 1, "amount": 400.0 }
  }
}
```

- `current` = not yet due (due today or later). Always all four keys.

## 4. `GET /api/analytics/attendance-by-class?date=YYYY-MM-DD&range=day|week`

Attendance rate per class via `AttendanceRecord → Student → Placement → Class`.
Default: today, `range=day`. `range=week` = trailing 7 days ending `date`.

```json
{
  "date": "2026-08-05",
  "range": "week",
  "windowStart": "2026-07-30",
  "classes": [
    { "classId": "242b5c22-…", "className": "JHS 1A", "present": 19, "total": 22, "ratePct": 86 }
  ],
  "skippedUnassigned": 1
}
```

- `skippedUnassigned` = records whose student has no active class placement.

## 5. `GET /api/analytics/enrollment-distribution`

Students per class + gender split (ACTIVE students, via Placement; gender from Demographics).

```json
{
  "total": 5,
  "classes": [
    { "classId": "…", "className": "JHS 1A", "students": 3, "male": 1, "female": 1, "other": 1 },
    { "classId": null, "className": "Unassigned", "students": 1, "male": 0, "female": 1, "other": 0 }
  ]
}
```

- Sorted by `students` desc; the `Unassigned` bucket (null/inactive class) is appended last and only if non-empty.

## 6. `GET /api/analytics/academic-performance?termId=`

School average GPA (ACTIVE students), per-class averages, per-subject pass
rates (**pass = letterGrade ≠ "F9"**), GPA distribution. Optional `termId`
narrows the grade-record slices (the GPA figures stay student-level).

```json
{
  "termId": null,
  "schoolAverageGpa": 2.0,
  "activeStudents": 4,
  "perClass": [{ "classId": "…", "className": "JHS 1A", "records": 3, "averagePoints": 1.0, "averageScore": 56.67 }],
  "perSubject": [{ "subjectId": "…", "subjectName": "Mathematics", "code": "MATH", "records": 3, "passRatePct": 67 }],
  "gpaDistribution": [
    { "bucket": "0-1", "students": 1 },
    { "bucket": "1-2", "students": 1 },
    { "bucket": "2-3", "students": 1 },
    { "bucket": "3-4", "students": 1 }
  ]
}
```

## 7. `GET /api/analytics/payroll-summary`

Standing monthly obligation (`Σ netPay` over TeacherPayroll + StaffPayroll rows)
alongside **this calendar month's** collections.

```json
{
  "month": "2026-08",
  "teachers": { "headcount": 2, "netPayTotal": 5500.0, "byStatus": { "PAID": 1, "PENDING": 1 } },
  "staff": { "headcount": 1, "netPayTotal": 2000.0, "byStatus": { "PENDING": 1 } },
  "monthlyObligation": 7500.0,
  "collectionsThisMonth": 10000.0,
  "collectionTransactions": 6,
  "netPosition": 2500.0,
  "coverageRatio": 1.33
}
```

- `coverageRatio` = collections ÷ obligation (`null` when no payroll rows exist).

## 8. `GET /api/analytics/top-debtors?limit=N`

Server-side top-N by outstanding `BillingLedger.currentBalance`. `limit`
default **10**, clamped **1–50**.

```json
{
  "limit": 1,
  "debtors": [
    {
      "studentInternalId": "12c84b0a-…",
      "studentId": "HHA-2024-0001",
      "studentName": "Ama Yaw Osei",
      "className": "JHS 1A",
      "balance": 1250.0
    }
  ]
}
```

## 9. `GET /api/analytics/activity-feed?limit=N`

Recent `AuditLog` events, newest first. `limit` default **20**, clamped
**1–100**. `requestBody` is deliberately excluded; `entity` is derived from the
request path (`/api/students/…` → `students`).

```json
{
  "limit": 20,
  "events": [
    {
      "id": "cm…",
      "at": "2026-08-05T08:41:12.000Z",
      "actor": { "id": "…", "email": "admin@sms.local", "role": "ADMIN" },
      "action": "CREATE_STUDENT",
      "method": "POST",
      "entity": "students",
      "path": "/api/students",
      "status": 201
    }
  ]
}
```
'''

TESTS = '''/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    paymentCollection: { findMany: vi.fn(), aggregate: vi.fn() },
    expense: { findMany: vi.fn(), aggregate: vi.fn() },
    invoice: { findMany: vi.fn() },
    attendanceRecord: { findMany: vi.fn() },
    placement: { findMany: vi.fn() },
    student: { findMany: vi.fn() },
    gradeRecord: { findMany: vi.fn() },
    teacherPayroll: { findMany: vi.fn() },
    staffPayroll: { findMany: vi.fn() },
    billingLedger: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';

const service = new AnalyticsService();

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.paymentCollection.findMany.mockResolvedValue([]);
  prismaMock.expense.findMany.mockResolvedValue([]);
  prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { _all: 0 } });
  prismaMock.invoice.findMany.mockResolvedValue([]);
  prismaMock.attendanceRecord.findMany.mockResolvedValue([]);
  prismaMock.placement.findMany.mockResolvedValue([]);
  prismaMock.student.findMany.mockResolvedValue([]);
  prismaMock.gradeRecord.findMany.mockResolvedValue([]);
  prismaMock.teacherPayroll.findMany.mockResolvedValue([]);
  prismaMock.staffPayroll.findMany.mockResolvedValue([]);
  prismaMock.paymentCollection.aggregate.mockResolvedValue({ _sum: { amountPaid: 0 }, _count: { _all: 0 } });
  prismaMock.billingLedger.findMany.mockResolvedValue([]);
  prismaMock.auditLog.findMany.mockResolvedValue([]);
});

describe('getCollectionsByChannel (SMS-011)', () => {
  it('groups channel totals/counts and zero-fills the monthly series', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    try {
      prismaMock.paymentCollection.findMany.mockResolvedValue([
        { amountPaid: 100, paymentMethod: 'CASH', dateProcessed: new Date('2026-08-10T00:00:00Z') },
        { amountPaid: 50, paymentMethod: 'CASH', dateProcessed: new Date('2026-08-20T00:00:00Z') },
        { amountPaid: 200, paymentMethod: 'CASH', dateProcessed: new Date('2026-09-05T00:00:00Z') },
        { amountPaid: 300, paymentMethod: 'MOBILE_MONEY', dateProcessed: new Date('2026-09-06T00:00:00Z') },
      ]);

      const data = await service.getCollectionsByChannel(3);

      expect(data.window).toMatchObject({ months: 3, startMonth: '2026-08', endMonth: '2026-10' });
      expect(data.channels).toEqual([
        { channel: 'CASH', total: 350, count: 3 },
        { channel: 'MOBILE_MONEY', total: 300, count: 1 },
      ]);
      expect(data.monthly).toHaveLength(3);
      expect(data.monthly[0]).toEqual({ month: '2026-08', total: 150, byChannel: { CASH: 150 } });
      expect(data.monthly[1]).toEqual({
        month: '2026-09',
        total: 500,
        byChannel: { CASH: 200, MOBILE_MONEY: 300 },
      });
      expect(data.monthly[2]).toEqual({ month: '2026-10', total: 0, byChannel: {} });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getExpenseBreakdown (SMS-011)', () => {
  it('spends CLEARED rows only, reports pending meta, computes the monthly net position', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
    try {
      prismaMock.expense.findMany.mockResolvedValue([
        { amount: 400, category: 'UTILITIES', expenseDate: new Date('2026-08-11T00:00:00Z') },
        { amount: 200, category: 'SUPPLIES', expenseDate: new Date('2026-09-03T00:00:00Z') },
      ]);
      prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 150 }, _count: { _all: 2 } });
      prismaMock.paymentCollection.findMany.mockResolvedValue([
        { amountPaid: 1000, dateProcessed: new Date('2026-09-04T00:00:00Z') },
      ]);

      const data = await service.getExpenseBreakdown(2);

      expect(data.spendBasis).toBe('CLEARED');
      expect(data.categories).toEqual([
        { category: 'UTILITIES', total: 400, count: 1 },
        { category: 'SUPPLIES', total: 200, count: 1 },
      ]);

      const clearedWhere = (prismaMock.expense.findMany.mock.calls[0]?.[0] as any).where;
      expect(clearedWhere.status).toBe('CLEARED');
      expect(data.pendingApproval).toEqual({ total: 150, count: 2 });

      expect(data.netPosition).toEqual([
        { month: '2026-08', collections: 0, expenses: 400, net: -400 },
        { month: '2026-09', collections: 1000, expenses: 200, net: 800 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getReceivablesAging (SMS-011)', () => {
  it('buckets outstanding invoice balances against today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T00:00:00Z'));
    try {
      prismaMock.invoice.findMany.mockResolvedValue([
        { amount: 500, paidAmount: 0, dueDate: new Date('2026-08-20T00:00:00Z') }, // current
        { amount: 300, paidAmount: 0, dueDate: new Date('2026-07-20T00:00:00Z') }, // 16d
        { amount: 400, paidAmount: 200, dueDate: new Date('2026-06-15T00:00:00Z') }, // 51d
        { amount: 400, paidAmount: 0, dueDate: new Date('2026-05-01T00:00:00Z') }, // 96d
        { amount: 700, paidAmount: 700, dueDate: new Date('2026-05-01T00:00:00Z') }, // settled -> skip
      ]);

      const data = await service.getReceivablesAging();

      expect(data.asOf).toBe('2026-08-05');
      expect(data.buckets.current).toEqual({ count: 1, amount: 500 });
      expect(data.buckets.days1to30).toEqual({ count: 1, amount: 300 });
      expect(data.buckets.days31to60).toEqual({ count: 1, amount: 200 });
      expect(data.buckets.over60).toEqual({ count: 1, amount: 400 });
      expect(data.totalOutstanding).toBe(1400);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getAttendanceByClass (SMS-011)', () => {
  it('computes per-class rates over the target day (PRESENT|LATE numerator)', async () => {
    prismaMock.attendanceRecord.findMany.mockResolvedValue([
      { status: 'PRESENT', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'LATE', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'ABSENT', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'PRESENT', student: { placement: { class: { id: 'c1', name: 'JHS 1A', deletedAt: null } } } },
      { status: 'PRESENT', student: { placement: { class: { id: 'c2', name: 'JHS 2A', deletedAt: null } } } },
      { status: 'ABSENT', student: { placement: { class: { id: 'c2', name: 'JHS 2A', deletedAt: null } } } },
      { status: 'PRESENT', student: { placement: null } },
    ]);

    const data = await service.getAttendanceByClass({ date: '2026-08-05' });

    expect(data.date).toBe('2026-08-05');
    expect(data.range).toBe('day');
    expect(data.classes).toEqual([
      { classId: 'c1', className: 'JHS 1A', present: 3, total: 4, ratePct: 75 },
      { classId: 'c2', className: 'JHS 2A', present: 1, total: 2, ratePct: 50 },
    ]);
    expect(data.skippedUnassigned).toBe(1);
  });

  it('range=week widens the window to the trailing 7 days', async () => {
    await service.getAttendanceByClass({ date: '2026-08-05', range: 'week' });
    const where = (prismaMock.attendanceRecord.findMany.mock.calls[0]?.[0] as any).where;
    expect(where.date.gte.toISOString()).toBe('2026-07-30T00:00:00.000Z');
    expect(where.date.lte.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });
});

describe('getEnrollmentDistribution (SMS-011)', () => {
  it('counts ACTIVE students per class with gender split and an unassigned tail', async () => {
    prismaMock.placement.findMany.mockResolvedValue([
      { classId: 'c1', class: { name: 'JHS 1A', deletedAt: null }, student: { demographics: { gender: 'Male' } } },
      { classId: 'c1', class: { name: 'JHS 1A', deletedAt: null }, student: { demographics: { gender: 'Female' } } },
      { classId: 'c1', class: { name: 'JHS 1A', deletedAt: null }, student: { demographics: null } },
      { classId: 'c2', class: { name: 'JHS 2A', deletedAt: null }, student: { demographics: { gender: 'male' } } },
      { classId: null, class: null, student: { demographics: { gender: 'Female' } } },
    ]);

    const data = await service.getEnrollmentDistribution();

    expect(data.total).toBe(5);
    expect((prismaMock.placement.findMany.mock.calls[0]?.[0] as any).where).toEqual({
      student: { status: 'ACTIVE' },
    });
    expect(data.classes[0]).toEqual({
      classId: 'c1',
      className: 'JHS 1A',
      students: 3,
      male: 1,
      female: 1,
      other: 1,
    });
    expect(data.classes[1]).toMatchObject({ classId: 'c2', className: 'JHS 2A', students: 1, male: 1 });
    expect(data.classes[2]).toMatchObject({ classId: null, className: 'Unassigned', students: 1, female: 1 });
  });
});

describe('getAcademicPerformance (SMS-011)', () => {
  it('aggregates GPA, per-class averages, per-subject pass rates (F9 fails), distribution', async () => {
    prismaMock.student.findMany.mockResolvedValue([
      { currentGpa: 0.5 },
      { currentGpa: 1.5 },
      { currentGpa: 2.5 },
      { currentGpa: 3.5 },
    ]);
    prismaMock.gradeRecord.findMany.mockResolvedValue([
      { finalScore: 80, gradePoints: 1.0, letterGrade: 'A1', class: { id: 'cA', name: 'JHS 1A' }, subject: { id: 'sM', name: 'Mathematics', code: 'MATH' } },
      { finalScore: 20, gradePoints: 0.0, letterGrade: 'F9', class: { id: 'cA', name: 'JHS 1A' }, subject: { id: 'sM', name: 'Mathematics', code: 'MATH' } },
      { finalScore: 70, gradePoints: 2.0, letterGrade: 'B2', class: { id: 'cA', name: 'JHS 1A' }, subject: { id: 'sE', name: 'English Language', code: 'ENG' } },
      { finalScore: 60, gradePoints: 2.0, letterGrade: 'B2', class: { id: 'cB', name: 'JHS 2A' }, subject: { id: 'sM', name: 'Mathematics', code: 'MATH' } },
    ]);

    const data = await service.getAcademicPerformance();

    expect(data.schoolAverageGpa).toBe(2);
    expect(data.activeStudents).toBe(4);
    expect(data.gpaDistribution).toEqual([
      { bucket: '0-1', students: 1 },
      { bucket: '1-2', students: 1 },
      { bucket: '2-3', students: 1 },
      { bucket: '3-4', students: 1 },
    ]);
    expect(data.perClass).toEqual([
      { classId: 'cA', className: 'JHS 1A', records: 3, averagePoints: 1, averageScore: 56.67 },
      { classId: 'cB', className: 'JHS 2A', records: 1, averagePoints: 2, averageScore: 60 },
    ]);
    expect(data.perSubject).toEqual([
      { subjectId: 'sE', subjectName: 'English Language', code: 'ENG', records: 1, passRatePct: 100 },
      { subjectId: 'sM', subjectName: 'Mathematics', code: 'MATH', records: 3, passRatePct: 67 },
    ]);
  });
});

describe('getPayrollSummary (SMS-011)', () => {
  it('sums teacher+staff net pay against the current month collections', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T12:00:00Z'));
    try {
      prismaMock.teacherPayroll.findMany.mockResolvedValue([
        { netPay: 3000, salaryStatus: 'PAID' },
        { netPay: 2500, salaryStatus: 'PENDING' },
      ]);
      prismaMock.staffPayroll.findMany.mockResolvedValue([{ netPay: 2000, salaryStatus: 'PENDING' }]);
      prismaMock.paymentCollection.aggregate.mockResolvedValue({
        _sum: { amountPaid: 10000 },
        _count: { _all: 6 },
      });

      const data = await service.getPayrollSummary();

      expect(data.month).toBe('2026-08');
      expect(data.teachers).toEqual({ headcount: 2, netPayTotal: 5500, byStatus: { PAID: 1, PENDING: 1 } });
      expect(data.staff).toEqual({ headcount: 1, netPayTotal: 2000, byStatus: { PENDING: 1 } });
      expect(data.monthlyObligation).toBe(7500);
      expect(data.collectionsThisMonth).toBe(10000);
      expect(data.netPosition).toBe(2500);
      expect(data.coverageRatio).toBe(1.33);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getTopDebtors (SMS-011)', () => {
  it('returns the mapped debtor shape', async () => {
    prismaMock.billingLedger.findMany.mockResolvedValue([
      {
        currentBalance: 1250,
        student: { id: 'i1', studentId: 'HHA-2024-0001', studentName: 'Ama Yaw Osei', placement: { class: { name: 'JHS 1A' } } },
      },
    ]);

    const data = await service.getTopDebtors(1);

    expect(data.debtors).toEqual([
      {
        studentInternalId: 'i1',
        studentId: 'HHA-2024-0001',
        studentName: 'Ama Yaw Osei',
        className: 'JHS 1A',
        balance: 1250,
      },
    ]);
  });

  it('clamps runaway limits at 50 (orderBy desc, take=clamped)', async () => {
    await service.getTopDebtors(500);
    const call = prismaMock.billingLedger.findMany.mock.calls[0]?.[0] as any;
    expect(call.take).toBe(50);
    expect(call.orderBy).toEqual({ currentBalance: 'desc' });
    expect(call.where).toEqual({ currentBalance: { gt: 0 } });
  });
});

describe('getActivityFeed (SMS-011)', () => {
  it('maps audit rows, derives entity from path, clamps limit at 100', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        createdAt: new Date('2026-08-05T08:41:12Z'),
        actorId: 'u1',
        actorEmail: 'admin@sms.local',
        actorRole: 'ADMIN',
        action: 'CREATE_STUDENT',
        method: 'POST',
        path: '/api/students',
        responseStatus: 201,
      },
      {
        id: 'a2',
        createdAt: new Date('2026-08-05T08:40:00Z'),
        actorId: 'u2',
        actorEmail: 'staff01@horizon.local',
        actorRole: 'STAFF',
        action: 'LOGIN',
        method: 'POST',
        path: '/api/auth/login',
        responseStatus: 200,
      },
    ]);

    const data = await service.getActivityFeed(500);

    expect(data.limit).toBe(100);
    expect((prismaMock.auditLog.findMany.mock.calls[0]?.[0] as any).take).toBe(100);
    expect(data.events![0]).toMatchObject({
      action: 'CREATE_STUDENT',
      entity: 'students',
      actor: { email: 'admin@sms.local', role: 'ADMIN' },
      status: 201,
    });
    expect(data.events![1]).toMatchObject({ entity: 'auth', at: '2026-08-05T08:40:00.000Z' });
  });
});

describe('analytics route guard matrix (SMS-011)', () => {
  // Same tuple the nine new routes mount behind: requireRole(ADMIN, ACCOUNTANT, STAFF)
  const guard = requireRole(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF);
  const mockRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

  it('rejects STUDENT and FACULTY with 403', () => {
    for (const role of [ROLES.STUDENT, ROLES.FACULTY]) {
      const next = vi.fn();
      guard({ user: { role } } as AuthenticatedRequest, mockRes() as any, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect((next.mock.calls[0]![0]! as AppError).statusCode).toBe(403);
    }
  });

  it('allows ADMIN, ACCOUNTANT and STAFF', () => {
    for (const role of [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF]) {
      const next = vi.fn();
      guard({ user: { role } } as AuthenticatedRequest, mockRes() as any, next);
      expect(next).toHaveBeenCalledWith();
    }
  });
});
'''


def main() -> None:
    if not BACKEND.is_dir():
        raise SystemExit("ABORT: sms-core-backend/ not found. Run from ~/sms-monorepo.")

    service = BACKEND / "src/modules/analytics/analytics.service.ts"
    controller = BACKEND / "src/modules/analytics/analytics.controller.ts"
    routes = BACKEND / "src/modules/analytics/analytics.routes.ts"

    c = edit(service, "export class AnalyticsService {\n", SERVICE_HELPERS + "export class AnalyticsService {\n", "service helpers", "clampMonths")
    c = edit(service, "      chartData,\n    };\n  }\n}\n", "      chartData,\n    };\n  }\n" + SERVICE_METHODS, "service methods (9)", "getReceivablesAging")
    service.write_text(c, encoding="utf-8")

    c = edit(controller, "export class AnalyticsController {\n", CONTROLLER_HELPER, "controller parseQueryInt", "parseQueryInt")
    c = edit(controller, "    } catch (error) {\n      next(error);\n    }\n  };\n}\n", "    } catch (error) {\n      next(error);\n    }\n  };\n" + CONTROLLER_PROPS, "controller handlers (9)", "getCollectionsByChannel")
    controller.write_text(c, encoding="utf-8")

    c = routes.read_text(encoding="utf-8")
    c = edit(routes, "router.get('/dashboard', dashboardAccess, controller.getDashboard);\n", "router.get('/dashboard', dashboardAccess, controller.getDashboard);\n" + ROUTES_ADD, "routes (9)", "/collections-by-channel")
    routes.write_text(c, encoding="utf-8")

    create(BACKEND / "docs/DASHBOARD_DATA_API.md", DOC)
    create(BACKEND / "src/__tests__/unit/services/analytics.service.test.ts", TESTS)

    print()
    print("SMS-011 applied. Next: backend gates, docker rebuild, live smoke of the nine endpoints.")
    print("APPLY011_EXIT=0")


if __name__ == "__main__":
    main()
