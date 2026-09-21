import { fetchWithAuth, ApiClientError } from "@/lib/fetch-with-auth"

export type TransportDirection = "TO_SCHOOL" | "FROM_SCHOOL"

export interface TransportBus {
  id: string
  code: string
  registrationNumber: string | null
  capacity: number | null
  isActive: boolean
  _count?: { assignments: number; trips: number; devices: number }
}

export interface TransportStudent {
  id: string
  studentId: string
  studentName: string
  placement?: { classId: string | null; class: { name: string } | null } | null
  transportCards?: Array<{ id: string; qrToken: string; issuedAt: string }>
}

export interface TransportRosterEntry {
  assignmentId: string
  student: {
    id: string
    studentId: string
    studentName: string
    className: string | null
  }
  card: {
    id: string
    qrToken: string
    tokenVersion: number
    issuedAt: string
  } | null
  effectiveFrom: string
  effectiveTo: string | null
}

export interface TransportRoster {
  bus: { id: string; code: string; capacity: number | null }
  serviceDate: string
  direction: TransportDirection
  rosterVersion: string
  generatedAt: string
  staleAfterHours: number
  isVersionStale: boolean
  warnings: string[]
  roster: TransportRosterEntry[]
}

export interface TransportTrip {
  id: string
  busId: string
  serviceDate: string
  direction: TransportDirection
  status: "OPEN" | "CLOSED" | "CANCELLED"
  operatorId: string | null
  startedAt: string
  endedAt: string | null
  bus: { id: string; code: string; capacity: number | null }
  _count?: { events: number }
}

export interface TransportSyncResult {
  clientEventId: string
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED"
  code: string
  studentId?: string
  assignmentStatus?: "ASSIGNED" | "UNASSIGNED"
  warnings: string[]
}

export interface TransportSyncResponse {
  batchId: string
  tripId: string
  deviceCode: string
  acceptedCount: number
  duplicateCount: number
  rejectedCount: number
  warningCount: number
  results: TransportSyncResult[]
}

export interface TransportReport {
  from: string
  to: string
  summary: {
    totalBoardings: number
    uniqueStudents: number
    wrongBusOrUnassigned: number
    byBus: Record<string, number>
    byDirection: Record<string, number>
  }
  exceptions: Array<{
    id: string
    clientEventId: string
    code: string
    assignmentStatus: "ASSIGNED" | "UNASSIGNED"
    student: { id: string; studentId: string; studentName: string }
    bus: { id: string; code: string }
    direction: TransportDirection
    serviceDate: string
    deviceCapturedAt: string
    rosterVersion: string | null
  }>
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(path, options)
  const payload = await response.json().catch(() => null) as { success?: boolean; message?: string; data?: T } | null
  if (!response.ok || !payload?.success) {
    throw new ApiClientError(response.status, payload?.message || `Transport request failed. HTTP ${response.status}`, payload)
  }
  return payload.data as T
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
})

export function getTransportBuses() {
  return request<TransportBus[]>("/transport/buses")
}

export function createTransportBus(body: { code: string; registrationNumber?: string | null; capacity?: number | null }) {
  return request<TransportBus>("/transport/buses", json(body))
}

export function getTransportStudents(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : ""
  return request<TransportStudent[]>(`/transport/students${query}`)
}

export function assignTransportStudent(body: { studentId: string; busId: string; effectiveFrom: string; effectiveTo?: string | null }) {
  return request("/transport/assignments", json(body))
}

export function issueTransportCard(body: { studentId: string; replaceExisting?: boolean }) {
  return request<{ id: string; qrToken: string; tokenVersion: number; status: string; student: { studentName: string } }>("/transport/cards", json(body))
}

export function openTransportTrip(body: { busId: string; serviceDate: string; direction: TransportDirection }) {
  return request<TransportTrip>("/transport/trips", json(body))
}

export function getTransportTrips(serviceDate?: string) {
  const query = serviceDate ? `?serviceDate=${encodeURIComponent(serviceDate)}` : ""
  return request<TransportTrip[]>(`/transport/trips${query}`)
}

export function updateTransportTripStatus(id: string, status: "OPEN" | "CLOSED" | "CANCELLED") {
  return request<TransportTrip>(`/transport/trips/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export function getTransportRoster(params: { busId: string; serviceDate: string; direction: TransportDirection; knownVersion?: string }) {
  const query = new URLSearchParams({
    busId: params.busId,
    serviceDate: params.serviceDate,
    direction: params.direction,
  })
  if (params.knownVersion) query.set("knownVersion", params.knownVersion)
  return request<TransportRoster>(`/transport/roster?${query.toString()}`)
}

export function syncTransportBatch(body: {
  batchId: string
  deviceCode: string
  tripId: string
  events: Array<{
    clientEventId: string
    qrToken?: string | null
    studentId?: string | null
    source: "QR" | "MANUAL"
    deviceCapturedAt: string
    rosterVersion?: string | null
    manualReason?: string | null
  }>
}) {
  return request<TransportSyncResponse>("/transport/sync", json(body))
}

export function getTransportReport(params: { from: string; to: string; busId?: string }) {
  const query = new URLSearchParams({ from: params.from, to: params.to })
  if (params.busId) query.set("busId", params.busId)
  return request<TransportReport>(`/transport/reports/boardings?${query.toString()}`)
}
