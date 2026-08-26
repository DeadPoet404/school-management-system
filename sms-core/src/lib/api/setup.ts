import { fetchWithAuth, ApiClientError } from "@/lib/fetch-with-auth"

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "")

export interface SetupSteps {
  schoolProfile: boolean
  adminAccount: boolean
  academicTerms: boolean
  classes: boolean
  curriculum: boolean
  ledger: boolean
  completed: boolean
}

export interface SetupStatus {
  initialized: boolean
  setupCompleted: boolean
  hasAdmin: boolean
  schoolName: string | null
  schoolCode: string | null
  country: string | null
  timezone: string | null
  currency: string | null
  setupVersion: number
  steps: SetupSteps
  requiresSetup: boolean
}

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

async function publicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
  })
  const json = await parseJson<T>(res)
  if (!res.ok || !json.success || json.data === undefined) {
    throw new ApiClientError(res.status, json.message || `Request failed (HTTP ${res.status})`, json)
  }
  return json.data
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(path, init)
  const json = await parseJson<T>(res)
  if (!res.ok || !json.success || json.data === undefined) {
    throw new ApiClientError(res.status, json.message || `Request failed (HTTP ${res.status})`, json)
  }
  return json.data
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return publicJson<SetupStatus>("/setup/status")
}

export async function bootstrapSetup(payload: {
  school: {
    schoolName: string
    schoolCode: string
    motto?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    country?: string
    timezone?: string
    currency?: string
  }
  admin: { fullName: string; email: string; password: string }
}): Promise<{
  status: SetupStatus
  admin: { email: string; fullName: string; staffId: string; role: string }
}> {
  return publicJson("/setup/bootstrap", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function saveSetupAcademic(payload: {
  terms: Array<{
    name: string
    academicYear: string
    startDate: string
    endDate: string
    isActive?: boolean
  }>
}): Promise<SetupStatus> {
  return authJson<SetupStatus>("/setup/academic", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function saveSetupClasses(payload: {
  classes: Array<{ name: string; section?: string | null; isActive?: boolean }>
}): Promise<SetupStatus> {
  return authJson<SetupStatus>("/setup/classes", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function saveSetupCurriculum(payload: {
  departments: Array<{ name: string; code: string }>
  subjects: Array<{ name: string; code: string }>
}): Promise<SetupStatus> {
  return authJson<SetupStatus>("/setup/curriculum", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function saveSetupLedger(payload?: {
  useDefaults?: boolean
}): Promise<SetupStatus> {
  return authJson<SetupStatus>("/setup/ledger", {
    method: "POST",
    body: JSON.stringify(payload ?? { useDefaults: true }),
  })
}

export async function completeSetup(): Promise<SetupStatus> {
  return authJson<SetupStatus>("/setup/complete", {
    method: "POST",
    body: JSON.stringify({}),
  })
}
