import { fetchWithAuth, ApiClientError } from "@/lib/fetch-with-auth"

// ── Types ────────────────────────────────────────────────────────────────────

export interface InstitutionProfile {
  id: number
  schoolName: string
  schoolCode: string
  motto: string | null
  address: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
  country: string
  timezone: string
  currency: string
  setupCompletedAt: string | null
  setupVersion: number
  updatedAt: string
}

export interface InstitutionUpdatePayload {
  schoolName?: string
  schoolCode?: string
  motto?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  country?: string
  timezone?: string
  currency?: string
}

export interface DataSummary {
  students: number
  guardians: number
  attendanceRecords: number
  gradeRecords: number
  teachers: number
  staff: number
  payrollRows: number
  classes: number
  subjects: number
  terms: number
  invoices: number
  payments: number
  paymentCollections: number
  paymentIntents: number
  expenses: number
  feeStructures: number
  feeTiers: number
  feeComponents: number
  announcements: number
  auditLogs: number
}

export type WipeScope = "students" | "personnel" | "financial" | "all"

export interface WipeResult {
  scope: WipeScope
  counts: Record<string, number>
  preserved: string[]
  message: string
}

export interface AuditEntry {
  id: string
  requestId: string
  actorId: string
  actorEmail: string
  actorRole: string
  action: string
  method: string
  path: string
  requestBody: unknown
  responseStatus: number
  ipAddress: string
  createdAt: string
}

// ── Envelope parsing ─────────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  success?: boolean
  message?: string
  data?: T
}

async function parseJson<T>(res: Response): Promise<ApiEnvelope<T>> {
  const text = await res.text()
  try {
    return text ? (JSON.parse(text) as ApiEnvelope<T>) : {}
  } catch {
    throw new ApiClientError(res.status, `Invalid JSON response (HTTP ${res.status})`, text)
  }
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(path, init)
  const json = await parseJson<T>(res)
  if (!res.ok || !json.success || json.data === undefined) {
    throw new ApiClientError(res.status, json.message || `Request failed (HTTP ${res.status})`, json)
  }
  return json.data
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export async function getInstitution(): Promise<InstitutionProfile> {
  return authJson<InstitutionProfile>("/admin/institution")
}

export async function updateInstitution(
  payload: InstitutionUpdatePayload
): Promise<InstitutionProfile> {
  return authJson<InstitutionProfile>("/admin/institution", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function getDataSummary(): Promise<DataSummary> {
  return authJson<DataSummary>("/admin/data/summary")
}

export async function wipeData(scope: WipeScope, confirm: string): Promise<WipeResult> {
  return authJson<WipeResult>("/admin/data/wipe", {
    method: "POST",
    body: JSON.stringify({ scope, confirm }),
  })
}

export async function getAuditLog(limit = 50): Promise<AuditEntry[]> {
  return authJson<AuditEntry[]>(`/admin/audit?limit=${limit}`)
}

/**
 * Downloads a CSV export from an existing list endpoint that supports
 * ?format=csv (people + finance modules).
 */
export async function downloadCsvExport(path: string, filename: string): Promise<void> {
  const response = await fetchWithAuth(`${path}?format=csv`)

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    let message = `Export failed (HTTP ${response.status}).`
    try {
      const json = JSON.parse(text) as ApiEnvelope<unknown>
      if (json.message) message = json.message
    } catch {
      /* keep default message */
    }
    throw new ApiClientError(response.status, message, text)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const CSV_EXPORTS: Array<{
  id: string
  label: string
  path: string
  filename: string
  zone: WipeScope
}> = [
  { id: "students", label: "Students", path: "/students", filename: "students.csv", zone: "students" },
  { id: "teachers", label: "Teachers", path: "/teachers", filename: "teachers.csv", zone: "personnel" },
  { id: "staff", label: "Staff", path: "/staff", filename: "staff.csv", zone: "personnel" },
  { id: "invoices", label: "Invoices", path: "/finance/invoices", filename: "finance-invoices.csv", zone: "financial" },
  { id: "collections", label: "Collections", path: "/finance/collections", filename: "finance-collections.csv", zone: "financial" },
  { id: "payroll", label: "Payroll", path: "/finance/payroll", filename: "finance-payroll.csv", zone: "financial" },
  { id: "expenses", label: "Expenses", path: "/finance/expenses", filename: "finance-expenses.csv", zone: "financial" },
]
