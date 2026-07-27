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
}
