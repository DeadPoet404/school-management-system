import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const FINANCE_BASE_PATH = "/finance";

interface ApiPaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalItems?: number;
  totalPages?: number;
}

interface ApiListResponse<T> {
  success?: boolean;
  data?: T[];
  pagination?: ApiPaginationMeta;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

interface PayrollApiRow {
  id: string;
  name: string;
  role?: string;
  baseSalary: number | string;
  allowances?: number | string;
  deductions: number | string;
  status: "Disbursed" | "Pending" | string;
}

interface CollectionApiRow {
  receiptNumber: string;
  sectionId: string;
  studentName?: string;
  amountPaid: number | string;
  paymentMethod: string;
  referenceNo: string;
  allocationTarget?: string;
  dateProcessed: string;
}

interface InvoiceApiRow {
  id?: string;
  invoiceNo?: string;
  studentId?: string;
  feeCategory?: string;
  description?: string;
  totalAmount?: number | string;
  amount?: number | string;
  paidAmount?: number | string;
  status?: "Paid" | "Partial" | "Overdue" | "PAID" | "PARTIAL" | "UNPAID" | string;
  issueDate?: string;
  createdAt?: string;
  dueDate?: string;
}

interface ExpenseApiRow {
  id?: string;
  expenseNo?: string;
  vendorName: string;
  category: string;
  description: string;
  amount: number | string;
  paymentMethod: string;
  status: "Cleared" | "Pending_Approval" | "Rejected" | "CLEARED" | "PENDING_APPROVAL" | "REJECTED" | string;
  expenseDate: string;
}

export interface PayrollRecord {
  id: string;
  staffName: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  payPeriod: string;
  status: "Paid" | "Processing" | "On_Hold";
}

export interface CollectionRecord {
  id: string;
  invoiceId: string;
  studentId: string;
  amountPaid: number;
  paymentMethod: string;
  referenceNo: string;
  dateProcessed: string;
  status: "Cleared" | "Pending";
}

export interface InvoiceRecord {
  id: string;
  studentId: string;
  feeCategory: string;
  totalAmount: number;
  paidAmount: number;
  status: "Paid" | "Partial" | "Overdue";
  issueDate: string;
  dueDate: string;
}

export interface ExpenseRecord {
  id: string;
  vendorName: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: "Cleared" | "Pending_Approval" | "Rejected";
  expenseDate: string;
}

export interface FinanceDashboardTotals {
  invoiced: number;
  collected: number;
  invoicePayments: number;
  outstanding: number;
  expenses: number;
  payroll: number;
  outflows: number;
  netCashflow: number;
}

export interface FinanceDashboardCounts {
  invoices: number;
  collections: number;
  expenses: number;
  payroll: number;
  paidInvoices: number;
  partialInvoices: number;
  openInvoices: number;
  pendingPayroll: number;
}

export interface FinanceDashboardTrendPoint {
  date: string;
  invoiced: number;
  collected: number;
  expenses: number;
  payroll: number;
  outflows: number;
  netCashflow: number;
  outstanding: number;
}

export interface FinanceDashboardData {
  windowDays: number;
  totals: FinanceDashboardTotals;
  counts: FinanceDashboardCounts;
  trend: FinanceDashboardTrendPoint[];
}

const emptyDashboardTotals: FinanceDashboardTotals = {
  invoiced: 0,
  collected: 0,
  invoicePayments: 0,
  outstanding: 0,
  expenses: 0,
  payroll: 0,
  outflows: 0,
  netCashflow: 0,
};

const emptyDashboardCounts: FinanceDashboardCounts = {
  invoices: 0,
  collections: 0,
  expenses: 0,
  payroll: 0,
  paidInvoices: 0,
  partialInvoices: 0,
  openInvoices: 0,
  pendingPayroll: 0,
};

function toNumber(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizePagination(
  pagination: ApiPaginationMeta | undefined,
  fallbackCount: number,
  requestedPage: number,
  requestedLimit: number,
): PaginationMeta {
  const total = toNumber(pagination?.total ?? pagination?.totalItems ?? fallbackCount);
  const limit = toNumber(pagination?.limit ?? requestedLimit) || requestedLimit;

  return {
    page: toNumber(pagination?.page ?? requestedPage) || requestedPage,
    limit,
    total,
    totalPages: toNumber(pagination?.totalPages ?? Math.ceil(total / Math.max(limit, 1))) || 0,
  };
}

async function fetchFinancePage<T>(resource: string, page: number, limit: number): Promise<PaginatedResult<T>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const res = await fetchWithAuth(`${FINANCE_BASE_PATH}/${resource}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch finance ${resource}`);

  const json = (await res.json()) as ApiListResponse<T>;
  const rows = Array.isArray(json.data) ? json.data : [];

  return {
    data: rows,
    pagination: normalizePagination(json.pagination, rows.length, page, limit),
  };
}

function normalizeInvoiceStatus(status: InvoiceApiRow["status"]): InvoiceRecord["status"] {
  if (status === "Paid" || status === "PAID") return "Paid";
  if (status === "Partial" || status === "PARTIAL") return "Partial";
  return "Overdue";
}

function normalizeExpenseStatus(status: ExpenseApiRow["status"]): ExpenseRecord["status"] {
  if (status === "Cleared" || status === "CLEARED") return "Cleared";
  if (status === "Rejected" || status === "REJECTED") return "Rejected";
  return "Pending_Approval";
}

function mapPayrollRecord(row: PayrollApiRow): PayrollRecord {
  return {
    id: row.id,
    staffName: row.name,
    baseSalary: toNumber(row.baseSalary),
    allowances: toNumber(row.allowances),
    deductions: toNumber(row.deductions),
    payPeriod: "Current Period",
    status: row.status === "Disbursed" ? "Paid" : "Processing",
  };
}

function mapCollectionRecord(row: CollectionApiRow): CollectionRecord {
  return {
    id: row.receiptNumber,
    invoiceId: row.allocationTarget || "N/A",
    studentId: row.sectionId,
    amountPaid: toNumber(row.amountPaid),
    paymentMethod: row.paymentMethod,
    referenceNo: row.referenceNo,
    dateProcessed: row.dateProcessed,
    status: "Cleared",
  };
}

function mapInvoiceRecord(row: InvoiceApiRow): InvoiceRecord {
  return {
    id: row.id || row.invoiceNo || "N/A",
    studentId: row.studentId || "N/A",
    feeCategory: row.feeCategory || row.description || "Fee Statement",
    totalAmount: toNumber(row.totalAmount ?? row.amount),
    paidAmount: toNumber(row.paidAmount),
    status: normalizeInvoiceStatus(row.status),
    issueDate: row.issueDate || row.createdAt || new Date().toISOString(),
    dueDate: row.dueDate || new Date().toISOString(),
  };
}

function mapExpenseRecord(row: ExpenseApiRow): ExpenseRecord {
  return {
    id: row.id || row.expenseNo || "N/A",
    vendorName: row.vendorName,
    category: row.category,
    description: row.description,
    amount: toNumber(row.amount),
    paymentMethod: row.paymentMethod,
    status: normalizeExpenseStatus(row.status),
    expenseDate: row.expenseDate,
  };
}

function normalizeTrendPoint(point: Partial<FinanceDashboardTrendPoint>): FinanceDashboardTrendPoint {
  return {
    date: point.date || new Date().toISOString().slice(0, 10),
    invoiced: toNumber(point.invoiced),
    collected: toNumber(point.collected),
    expenses: toNumber(point.expenses),
    payroll: toNumber(point.payroll),
    outflows: toNumber(point.outflows),
    netCashflow: toNumber(point.netCashflow),
    outstanding: toNumber(point.outstanding),
  };
}

function normalizeDashboardData(data: Partial<FinanceDashboardData> | undefined, days: number): FinanceDashboardData {
  const trend = Array.isArray(data?.trend) ? data.trend.map(normalizeTrendPoint) : [];

  return {
    windowDays: toNumber(data?.windowDays) || days,
    totals: { ...emptyDashboardTotals, ...(data?.totals ?? {}) },
    counts: { ...emptyDashboardCounts, ...(data?.counts ?? {}) },
    trend: trend.length > 0 ? trend : [normalizeTrendPoint({})],
  };
}

export function useFinanceDashboard(days: number = 90) {
  return useQuery({
    queryKey: ["finance", "dashboard", days],
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days) });
      const res = await fetchWithAuth(`${FINANCE_BASE_PATH}/dashboard?${params}`);
      if (!res.ok) throw new Error("Failed to fetch finance dashboard");

      const json = (await res.json()) as ApiEnvelope<FinanceDashboardData>;
      return normalizeDashboardData(json.data, days);
    },
  });
}

export function usePayroll(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "payroll", page, limit],
    queryFn: async () => {
      const result = await fetchFinancePage<PayrollApiRow>("payroll", page, limit);

      return {
        data: result.data.map(mapPayrollRecord),
        pagination: result.pagination,
      };
    },
    placeholderData: (prev) => prev,
  });
}

export function useCollections(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "collections", page, limit],
    queryFn: async () => {
      const result = await fetchFinancePage<CollectionApiRow>("collections", page, limit);

      return {
        data: result.data.map(mapCollectionRecord),
        pagination: result.pagination,
      };
    },
    placeholderData: (prev) => prev,
  });
}

export function useInvoices(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "invoices", page, limit],
    queryFn: async () => {
      const result = await fetchFinancePage<InvoiceApiRow>("invoices", page, limit);

      return {
        data: result.data.map(mapInvoiceRecord),
        pagination: result.pagination,
      };
    },
    placeholderData: (prev) => prev,
  });
}

export function useExpenses(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "expenses", page, limit],
    queryFn: async () => {
      const result = await fetchFinancePage<ExpenseApiRow>("expenses", page, limit);

      return {
        data: result.data.map(mapExpenseRecord),
        pagination: result.pagination,
      };
    },
    placeholderData: (prev) => prev,
  });
}
