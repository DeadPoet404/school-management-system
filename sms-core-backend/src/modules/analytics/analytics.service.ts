import { prisma } from '@/lib/prisma';

interface DashboardTrendBucket {
  date: string;
  collections: number;
  attendancePresent: number;
  attendanceTotal: number;
  assessments: number;
  enrollment: number;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function clampDays(days: number | undefined): number {
  if (!days || !Number.isFinite(days)) return 90;
  return Math.min(Math.max(Math.floor(days), 7), 365);
}

function clampMonths(months: number | undefined): number {
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
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** '/api/students/123' -> 'students'; '/health' -> 'health'. */
function entityFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[1] ?? segments[0] ?? 'root';
}

export class AnalyticsService {
  async getDashboard(daysInput?: number) {
    const days = clampDays(daysInput);
    const endDate = startOfUtcDay(new Date());
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const buckets: DashboardTrendBucket[] = Array.from({ length: days }, (_, index) => {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + index);

      return {
        date: toDateKey(date),
        collections: 0,
        attendancePresent: 0,
        attendanceTotal: 0,
        assessments: 0,
        enrollment: 0,
      };
    });

    const bucketByDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      totalStaff,
      attendanceRows,
      paymentRows,
      gradeRows,
      enrollmentRows,
      collectionTotals,
      invoiceTotals,
      openInvoices,
    ] = await prisma.$transaction([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'ACTIVE' } }),
      prisma.teacher.count({ where: { status: 'ACTIVE' } }),
      prisma.staff.count({ where: { status: 'ACTIVE' } }),
      prisma.attendanceRecord.findMany({
        where: { date: { gte: startDate } },
        select: { date: true, status: true },
      }),
      prisma.paymentCollection.findMany({
        where: { deletedAt: null, dateProcessed: { gte: startDate } },
        select: { amountPaid: true, dateProcessed: true },
      }),
      prisma.gradeRecord.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      prisma.student.findMany({
        where: { enrollmentDate: { gte: startDate } },
        select: { enrollmentDate: true },
      }),
      prisma.paymentCollection.aggregate({
        where: { deletedAt: null },
        _sum: { amountPaid: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { deletedAt: null },
        _sum: { amount: true, paidAmount: true },
        _count: { _all: true },
      }),
      prisma.invoice.count({
        where: {
          deletedAt: null,
          status: { in: ['UNPAID', 'PARTIAL'] },
        },
      }),
    ]);

    for (const attendance of attendanceRows) {
      const bucket = bucketByDate.get(toDateKey(attendance.date));
      if (!bucket) continue;

      bucket.attendanceTotal += 1;

      if (attendance.status === 'PRESENT' || attendance.status === 'LATE') {
        bucket.attendancePresent += 1;
      }
    }

    for (const payment of paymentRows) {
      const bucket = bucketByDate.get(toDateKey(payment.dateProcessed));
      if (!bucket) continue;

      bucket.collections += toNumber(payment.amountPaid);
    }

    for (const grade of gradeRows) {
      const bucket = bucketByDate.get(toDateKey(grade.createdAt));
      if (!bucket) continue;

      bucket.assessments += 1;
    }

    for (const student of enrollmentRows) {
      const bucket = bucketByDate.get(toDateKey(student.enrollmentDate));
      if (!bucket) continue;

      bucket.enrollment += 1;
    }

    const totalAttendancePresent = buckets.reduce((sum, bucket) => sum + bucket.attendancePresent, 0);
    const totalAttendanceRows = buckets.reduce((sum, bucket) => sum + bucket.attendanceTotal, 0);

    const chartData = buckets.map((bucket) => ({
      date: bucket.date,
      collections: roundCurrency(bucket.collections),
      attendance:
        bucket.attendanceTotal > 0
          ? Math.round((bucket.attendancePresent / bucket.attendanceTotal) * 100)
          : 0,
      assessments: bucket.assessments,
      enrollment: bucket.enrollment,
    }));

    const totalCollections = roundCurrency(toNumber(collectionTotals._sum.amountPaid));
    const totalInvoiced = roundCurrency(toNumber(invoiceTotals._sum.amount));
    const invoicePayments = roundCurrency(toNumber(invoiceTotals._sum.paidAmount));

    return {
      generatedAt: new Date().toISOString(),
      range: {
        startDate: toDateKey(startDate),
        endDate: toDateKey(endDate),
        days,
      },
      totals: {
        collections: totalCollections,
        attendance:
          totalAttendanceRows > 0
            ? Math.round((totalAttendancePresent / totalAttendanceRows) * 100)
            : 0,
        assessments: gradeRows.length,
        enrollment: enrollmentRows.length,
        totalStudents,
        activeStudents,
        totalTeachers,
        totalStaff,
        invoiced: totalInvoiced,
        invoicePayments,
        outstanding: Math.max(roundCurrency(totalInvoiced - invoicePayments), 0),
        openInvoices,
        collectionTransactions: collectionTotals._count._all,
        invoices: invoiceTotals._count._all,
      },
      chartData,
    };
  }

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
