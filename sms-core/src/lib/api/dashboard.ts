import { fetchWithAuth } from "@/lib/fetch-with-auth"

export interface DashboardApiEnvelope<T> {
  success?: boolean
  data?: T
  message?: string
}

export interface DashboardTotals {
  collections: number
  attendance: number
  assessments: number
  enrollment: number
  totalStudents: number
  activeStudents: number
  totalTeachers: number
  totalStaff: number
  invoiced: number
  invoicePayments: number
  outstanding: number
  openInvoices: number
  collectionTransactions: number
  invoices: number
}

export interface DashboardChartPoint {
  date: string
  collections: number
  attendance: number
  assessments: number
  enrollment: number
}

export interface DashboardSummary {
  generatedAt: string
  range: {
    startDate: string
    endDate: string
    days: number
  }
  totals: DashboardTotals
  chartData: DashboardChartPoint[]
}

export interface CollectionsByChannelData {
  generatedAt: string
  window: {
    months: number
    startMonth: string
    endMonth: string
  }
  channels: Array<{
    channel: string
    total: number
    count: number
  }>
  monthly: Array<{
    month: string
    total: number
    byChannel: Record<string, number>
  }>
}

export interface ExpenseBreakdownData {
  generatedAt: string
  window: {
    months: number
    startMonth: string
    endMonth: string
  }
  spendBasis: string
  categories: Array<{
    category: string
    total: number
    count: number
  }>
  monthly: Array<{
    month: string
    expenses: number
  }>
  pendingApproval: {
    total: number
    count: number
  }
  netPosition: Array<{
    month: string
    collections: number
    expenses: number
    net: number
  }>
}

export interface ReceivablesAgingData {
  asOf: string
  totalOutstanding: number
  buckets: {
    current: AgingBucket
    days1to30: AgingBucket
    days31to60: AgingBucket
    over60: AgingBucket
  }
}

export interface AgingBucket {
  count: number
  amount: number
}

export interface AttendanceByClassData {
  date: string
  range: "day" | "week"
  windowStart: string
  classes: Array<{
    classId: string
    className: string
    present: number
    total: number
    ratePct: number
  }>
  skippedUnassigned: number
}

export interface EnrollmentDistributionData {
  total: number
  classes: Array<{
    classId: string | null
    className: string
    students: number
    male: number
    female: number
    other: number
  }>
}

export interface AcademicPerformanceData {
  termId: string | null
  schoolAverageGpa: number
  activeStudents: number
  perClass: Array<{
    classId: string
    className: string
    records: number
    averagePoints: number
    averageScore: number
  }>
  perSubject: Array<{
    subjectId: string
    subjectName: string
    code: string
    records: number
    passRatePct: number
  }>
  gpaDistribution: Array<{
    bucket: string
    students: number
  }>
}

export interface PayrollSummaryData {
  month: string
  teachers: PayrollGroup
  staff: PayrollGroup
  monthlyObligation: number
  collectionsThisMonth: number
  collectionTransactions: number
  netPosition: number
  coverageRatio: number | null
}

export interface PayrollGroup {
  headcount: number
  netPayTotal: number
  byStatus: Record<string, number>
}

export interface TopDebtorsData {
  limit: number
  debtors: Array<{
    studentInternalId: string
    studentId: string
    studentName: string
    className: string
    balance: number
  }>
}

export interface ActivityFeedData {
  limit: number
  events: Array<{
    id: string
    at: string
    actor: {
      id: string
      email: string
      role: string
    }
    action: string
    method: string
    entity: string
    path: string
    status: number
  }>
}

async function getDashboardEndpoint<T>(path: string): Promise<T> {
  const response = await fetchWithAuth(path)

  let payload: DashboardApiEnvelope<T> | null = null

  try {
    payload = await response.json()
  } catch {
    throw new Error(`Dashboard endpoint returned invalid JSON: ${path}`)
  }

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(
      payload?.message ||
        `Dashboard endpoint failed with HTTP ${response.status}: ${path}`,
    )
  }

  return payload.data
}

export interface DashboardData {
  summary: DashboardSummary
  collectionsByChannel: CollectionsByChannelData
  expenseBreakdown: ExpenseBreakdownData
  receivablesAging: ReceivablesAgingData
  attendanceByClass: AttendanceByClassData
  enrollmentDistribution: EnrollmentDistributionData
  academicPerformance: AcademicPerformanceData
  payrollSummary: PayrollSummaryData
  topDebtors: TopDebtorsData
  activityFeed: ActivityFeedData
}

export async function getDashboardData(): Promise<DashboardData> {
  const [
    summary,
    collectionsByChannel,
    expenseBreakdown,
    receivablesAging,
    attendanceByClass,
    enrollmentDistribution,
    academicPerformance,
    payrollSummary,
    topDebtors,
    activityFeed,
  ] = await Promise.all([
    getDashboardEndpoint<DashboardSummary>("/analytics/dashboard?days=90"),
    getDashboardEndpoint<CollectionsByChannelData>(
      "/analytics/collections-by-channel?months=12",
    ),
    getDashboardEndpoint<ExpenseBreakdownData>(
      "/analytics/expense-breakdown?months=12",
    ),
    getDashboardEndpoint<ReceivablesAgingData>(
      "/analytics/receivables-aging",
    ),
    getDashboardEndpoint<AttendanceByClassData>(
      "/analytics/attendance-by-class?range=day",
    ),
    getDashboardEndpoint<EnrollmentDistributionData>(
      "/analytics/enrollment-distribution",
    ),
    getDashboardEndpoint<AcademicPerformanceData>(
      "/analytics/academic-performance",
    ),
    getDashboardEndpoint<PayrollSummaryData>(
      "/analytics/payroll-summary",
    ),
    getDashboardEndpoint<TopDebtorsData>(
      "/analytics/top-debtors?limit=10",
    ),
    getDashboardEndpoint<ActivityFeedData>(
      "/analytics/activity-feed?limit=20",
    ),
  ])

  return {
    summary,
    collectionsByChannel,
    expenseBreakdown,
    receivablesAging,
    attendanceByClass,
    enrollmentDistribution,
    academicPerformance,
    payrollSummary,
    topDebtors,
    activityFeed,
  }
}
