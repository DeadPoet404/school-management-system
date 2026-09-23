"use client"

import * as React from "react"
import {
  AlertTriangle,
  BusFront,
  CheckCircle2,
  CloudUpload,
  FileWarning,
  LoaderCircle,
  MapPin,
  QrCode,
  RefreshCw,
  ScanLine,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiClientError } from "@/lib/fetch-with-auth"
import {
  getTransportBuses,
  getTransportRoster,
  getTransportTrips,
  getTransportReport,
  openTransportTrip,
  syncTransportBatch,
  updateTransportTripStatus,
  type TransportBus,
  type TransportDirection,
  type TransportReport,
  type TransportRoster,
  type TransportSyncResponse,
  type TransportTrip,
} from "@/lib/api/transport"

const STORAGE_KEY = "sms.transport.driver.v1"

type FeedbackKind = "success" | "warning" | "error" | "info"
type Feedback = { kind: FeedbackKind; title: string; detail: string }

type QueueItem = {
  clientEventId: string
  tripId: string
  qrToken: string | null
  studentId: string
  studentName: string
  publicStudentId: string
  source: "QR" | "MANUAL"
  deviceCapturedAt: string
  rosterVersion: string | null
  manualReason: string | null
  localWarning?: string
  lastResult?: string
}

type PersistedDriver = {
  offline: boolean
  deviceCode: string
  serviceDate: string
  direction: TransportDirection
  selectedBusId: string
  tripId: string
  roster: TransportRoster | null
  rosterKey: string
  queue: QueueItem[]
  boardedKeys: string[]
  scanLog: Feedback[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function tomorrow(): string {
  const d = new Date(`${today()}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
function makeRosterKey(busId: string, serviceDate: string, direction: TransportDirection): string {
  return `${busId}:${serviceDate}:${direction}`
}
function feedbackClass(kind: FeedbackKind): string {
  if (kind === "success") return "border-emerald-200 bg-emerald-50 text-emerald-950"
  if (kind === "warning") return "border-amber-200 bg-amber-50 text-amber-950"
  if (kind === "error") return "border-rose-200 bg-rose-50 text-rose-950"
  return "border-sky-200 bg-sky-50 text-sky-950"
}
function prettyDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  } catch {
    return value
  }
}
function readPersisted(): Partial<PersistedDriver> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<PersistedDriver>) : null
  } catch {
    return null
  }
}

export function TransportDriverDashboard() {
  const persisted = React.useMemo(() => readPersisted(), [])
  const [hydrated, setHydrated] = React.useState(false)
  const [offline, setOffline] = React.useState(persisted?.offline ?? false)
  const [deviceCode, setDeviceCode] = React.useState(persisted?.deviceCode ?? "driver-device-01")
  const [serviceDate, setServiceDate] = React.useState(persisted?.serviceDate ?? today())
  const [direction, setDirection] = React.useState<TransportDirection>(persisted?.direction ?? "TO_SCHOOL")
  const [buses, setBuses] = React.useState<TransportBus[]>([])
  const [trips, setTrips] = React.useState<TransportTrip[]>([])
  const [selectedBusId, setSelectedBusId] = React.useState(persisted?.selectedBusId ?? "")
  const [tripId, setTripId] = React.useState(persisted?.tripId ?? "")
  const [roster, setRoster] = React.useState<TransportRoster | null>(persisted?.roster ?? null)
  const [rosterKey, setRosterKey] = React.useState(persisted?.rosterKey ?? "")
  const [queue, setQueue] = React.useState<QueueItem[]>(persisted?.queue ?? [])
  const [boardedKeys, setBoardedKeys] = React.useState<Set<string>>(new Set(persisted?.boardedKeys ?? []))
  const [scanLog, setScanLog] = React.useState<Feedback[]>(persisted?.scanLog ?? [])
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)
  const [lastSync, setLastSync] = React.useState<TransportSyncResponse | null>(null)
  const [report, setReport] = React.useState<TransportReport | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [scanValue, setScanValue] = React.useState("")
  const [manualStudentId, setManualStudentId] = React.useState("")
  const [manualReason, setManualReason] = React.useState("Card unreadable — driver confirmed identity")

  const currentTrip = trips.find((t) => t.id === tripId) ?? null
  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? null
  const currentRosterKey = makeRosterKey(selectedBusId, serviceDate, direction)
  const staleLocalRoster = Boolean(
    roster && rosterKey === currentRosterKey && Date.now() - new Date(roster.generatedAt).getTime() > roster.staleAfterHours * 60 * 60 * 1000
  )

  const persistState = React.useCallback(() => {
    if (!hydrated || typeof window === "undefined") return
    const snapshot: PersistedDriver = {
      offline,
      deviceCode,
      serviceDate,
      direction,
      selectedBusId,
      tripId,
      roster,
      rosterKey,
      queue,
      boardedKeys: Array.from(boardedKeys),
      scanLog: scanLog.slice(0, 20),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }, [boardedKeys, deviceCode, direction, hydrated, offline, queue, roster, rosterKey, scanLog, selectedBusId, serviceDate, tripId])

  React.useEffect(() => { setHydrated(true) }, [])
  React.useEffect(() => { persistState() }, [persistState])

  const addFeedback = React.useCallback((next: Feedback) => {
    setFeedback(next)
    setScanLog((prev) => [next, ...prev].slice(0, 20))
  }, [])

  const refreshDirectory = React.useCallback(async () => {
    if (offline) return
    setBusy("directory")
    setLoadError(null)
    try {
      const [busData, tripData] = await Promise.all([getTransportBuses(), getTransportTrips(serviceDate)])
      setBuses(busData)
      setTrips(tripData)
      if (!selectedBusId && busData[0]) setSelectedBusId(busData[0].id)
      if (!tripId) {
        const matching = tripData.find((t) => t.busId === (selectedBusId || busData[0]?.id) && t.direction === direction)
        if (matching) setTripId(matching.id)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Transport data could not be loaded.")
    } finally {
      setBusy(null)
    }
  }, [direction, offline, selectedBusId, serviceDate, tripId])

  React.useEffect(() => {
    if (hydrated && !offline) void refreshDirectory()
  }, [hydrated, offline, refreshDirectory])

  const loadRoster = React.useCallback(async () => {
    if (!selectedBusId) {
      addFeedback({ kind: "error", title: "Choose a bus first", detail: "Your assigned bus list comes from admin." })
      return
    }
    const key = makeRosterKey(selectedBusId, serviceDate, direction)
    if (offline) {
      if (roster && rosterKey === key) {
        addFeedback({
          kind: staleLocalRoster ? "warning" : "info",
          title: staleLocalRoster ? "Using a stale local roster" : "Local roster ready",
          detail: staleLocalRoster ? "Scanning remains enabled. Next sync includes stored version." : "No network request — cached roster.",
        })
      } else {
        addFeedback({ kind: "error", title: "No cached roster", detail: "Load this bus roster once while online before going offline." })
      }
      return
    }
    setBusy("roster")
    try {
      const next = await getTransportRoster({
        busId: selectedBusId,
        serviceDate,
        direction,
        knownVersion: rosterKey === key ? roster?.rosterVersion : undefined,
      })
      setRoster(next)
      setRosterKey(key)
      addFeedback({
        kind: next.isVersionStale ? "warning" : "success",
        title: next.isVersionStale ? "Roster changed" : "Roster downloaded",
        detail: `${next.roster.length} student(s) available offline. ${next.isVersionStale ? "Old copy remains usable." : "You can now scan offline."}`,
      })
    } catch (e) {
      addFeedback({ kind: "error", title: "Roster download failed", detail: e instanceof Error ? e.message : "Try again while online." })
    } finally {
      setBusy(null)
    }
  }, [addFeedback, direction, offline, roster, rosterKey, selectedBusId, serviceDate, staleLocalRoster])

  const openTrip = async (reopen = false) => {
    if (!selectedBusId) {
      addFeedback({ kind: "error", title: "Choose a bus first", detail: "A trip is per bus, date, direction." })
      return
    }
    if (offline) {
      addFeedback({ kind: "warning", title: "Trip start needs connectivity", detail: "Open the trip before going offline." })
      return
    }
    setBusy("trip")
    try {
      const next = await openTransportTrip({ busId: selectedBusId, serviceDate, direction, reopen })
      setTrips((prev) => [next, ...prev.filter((t) => t.id !== next.id)])
      setTripId(next.id)
      addFeedback({ kind: "success", title: reopen ? "Trip reopened" : "Trip is open", detail: `${next.bus.code} · ${direction.replace("_", " ")} · ${serviceDate}` })
    } catch (error) {
      if (!reopen && error instanceof ApiClientError && error.statusCode === 409) {
        setBusy(null)
        if (window.confirm("This trip is already closed or cancelled.\n\nReopen it? Its recorded close time will be cleared.")) {
          await openTrip(true)
        }
        return
      }
      addFeedback({ kind: "error", title: "Trip could not be opened", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const setTripFromSelection = (nextTripId: string) => {
    setTripId(nextTripId)
    const nextTrip = trips.find((t) => t.id === nextTripId)
    if (nextTrip) {
      setSelectedBusId(nextTrip.busId)
      setServiceDate(nextTrip.serviceDate.slice(0, 10))
      setDirection(nextTrip.direction)
    }
  }

  const queueScan = (token: string, source: "QR" | "MANUAL" = "QR") => {
    const value = token.trim()
    if (!value) {
      addFeedback({ kind: "error", title: "Nothing to scan", detail: "Paste an opaque QR token or use a roster button." })
      return
    }
    if (!tripId) {
      addFeedback({ kind: "error", title: "No open trip selected", detail: "Open a trip while online before scanning." })
      return
    }
    const rosterEntry = roster?.roster.find((e) => e.card?.qrToken === value)
    if (!rosterEntry) {
      addFeedback({ kind: "error", title: "Invalid QR token for this roster", detail: "Token not in downloaded roster. Re-download roster if child was newly assigned." })
      return
    }
    const boardingKey = `${tripId}:${rosterEntry.student.id}`
    if (boardedKeys.has(boardingKey) || queue.some((item) => `${item.tripId}:${item.studentId}` === boardingKey)) {
      addFeedback({ kind: "info", title: "Duplicate scan", detail: `${rosterEntry.student.studentName} already boarded for this trip.` })
      return
    }
    const item: QueueItem = {
      clientEventId: makeId(),
      tripId,
      qrToken: source === "QR" ? value : null,
      studentId: rosterEntry.student.id,
      studentName: rosterEntry.student.studentName,
      publicStudentId: rosterEntry.student.studentId,
      source,
      deviceCapturedAt: new Date().toISOString(),
      rosterVersion: roster?.rosterVersion ?? null,
      manualReason: source === "MANUAL" ? manualReason.trim() || "Manual identity confirmation" : null,
    }
    setQueue((prev) => [item, ...prev])
    setBoardedKeys((prev) => new Set(prev).add(boardingKey))
    setScanValue("")
    addFeedback({ kind: "success", title: "Captured offline", detail: `${rosterEntry.student.studentName} queued. Will sync when online.` })
  }

  const queueManualBoarding = () => {
    const entry = roster?.roster.find((e) => e.student.id === manualStudentId)
    if (!entry) {
      addFeedback({ kind: "error", title: "Choose a student", detail: "Manual boarding requires roster entry and reason." })
      return
    }
    queueScan(entry.card?.qrToken ?? "manual", "MANUAL")
  }

  const syncQueue = async () => {
    if (offline) {
      addFeedback({ kind: "warning", title: "Simulator is offline", detail: "Turn off offline mode to sync." })
      return
    }
    if (!queue.length) {
      addFeedback({ kind: "info", title: "Queue is empty", detail: "Capture scans first." })
      return
    }
    const syncItems = queue.filter((item) => item.tripId === tripId)
    if (!syncItems.length) {
      addFeedback({ kind: "warning", title: "Select the queued trip", detail: "Queue contains events for another trip." })
      return
    }
    setBusy("sync")
    try {
      const response = await syncTransportBatch({
        batchId: makeId(),
        deviceCode: deviceCode.trim() || "driver-device-01",
        tripId,
        events: syncItems.map((item) => ({
          clientEventId: item.clientEventId,
          qrToken: item.qrToken,
          studentId: item.studentId,
          source: item.source,
          deviceCapturedAt: item.deviceCapturedAt,
          rosterVersion: item.rosterVersion,
          manualReason: item.manualReason,
        })),
      })
      setLastSync(response)
      const resultById = new Map(response.results.map((r) => [r.clientEventId, r]))
      setQueue((prev) =>
        prev
          .map((item) => {
            const result = resultById.get(item.clientEventId)
            return result?.status === "REJECTED" ? { ...item, lastResult: `${result.code}${result.warnings.length ? ` · ${result.warnings.join(", ")}` : ""}` } : item
          })
          .filter((item) => {
            const result = resultById.get(item.clientEventId)
            return !result || result.status === "REJECTED"
          })
      )
      for (const item of syncItems) {
        const result = resultById.get(item.clientEventId)
        if (result?.status === "REJECTED") {
          setBoardedKeys((prev) => {
            const next = new Set(prev)
            next.delete(`${item.tripId}:${item.studentId}`)
            return next
          })
        }
      }
      addFeedback({
        kind: response.rejectedCount ? "warning" : "success",
        title: `Batch synced · ${response.acceptedCount} accepted`,
        detail: `${response.duplicateCount} duplicate, ${response.rejectedCount} rejected, ${response.warningCount} warning(s).`,
      })
    } catch (e) {
      addFeedback({ kind: "error", title: "Batch sync failed", detail: `${e instanceof Error ? e.message : "Network unavailable."} Queue kept.` })
    } finally {
      setBusy(null)
    }
  }

  const refreshReport = async () => {
    if (offline) {
      addFeedback({ kind: "info", title: "Reports need connectivity", detail: "Reports load after sync." })
      return
    }
    setBusy("report")
    try {
      const next = await getTransportReport({
        from: `${serviceDate}T00:00:00.000Z`,
        to: `${tomorrow()}T00:00:00.000Z`,
        busId: selectedBusId || undefined,
      })
      setReport(next)
    } catch (e) {
      addFeedback({ kind: "error", title: "Report could not be loaded", detail: e instanceof Error ? e.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const closeTrip = async () => {
    if (!tripId || offline) return
    setBusy("close-trip")
    try {
      const next = await updateTransportTripStatus(tripId, "CLOSED")
      setTrips((prev) => prev.map((t) => (t.id === next.id ? next : t)))
      addFeedback({ kind: "success", title: "Trip closed", detail: "New events rejected; retries remain idempotent." })
    } catch (e) {
      addFeedback({ kind: "error", title: "Trip could not be closed", detail: e instanceof Error ? e.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            <BusFront className="h-3.5 w-3.5" /> Driver portal
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">My bus trips</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
            You see only buses assigned to you. Download today&apos;s roster once, then scan offline. Sync when you have signal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOffline((v) => !v)}
            className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition", offline ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-900")}
            aria-pressed={offline}
          >
            {offline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            {offline ? "Offline mode" : "Online mode"}
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
            <CloudUpload className="h-3.5 w-3.5" /> {queue.length} queued
          </span>
        </div>
      </header>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><p className="font-semibold">Transport data unavailable</p><p className="mt-1 text-rose-800">{loadError}</p></div>
        </div>
      )}

      {feedback && (
        <div className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", feedbackClass(feedback.kind))}>
          {feedback.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : feedback.kind === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0"><p className="font-semibold">{feedback.title}</p><p className="mt-1 opacity-80">{feedback.detail}</p></div>
        </div>
      )}

      {/* Trip setup */}
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Trip setup</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">Today&apos;s run</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-stone-600">My buses
              <select value={selectedBusId} onChange={(e) => setSelectedBusId(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500">
                <option value="">Select your bus</option>
                {buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.code}{bus.registrationNumber ? ` · ${bus.registrationNumber}` : ""}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-stone-600">Service date
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-stone-600">Direction
              <select value={direction} onChange={(e) => setDirection(e.target.value as TransportDirection)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500">
                <option value="TO_SCHOOL">To school</option><option value="FROM_SCHOOL">From school</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-stone-600">Device code
              <input value={deviceCode} onChange={(e) => setDeviceCode(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void openTrip()} disabled={busy !== null || offline || !selectedBusId} className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-40"><BusFront className="h-3.5 w-3.5" /> {busy === "trip" ? "Opening…" : "Open trip"}</button>
            <button type="button" onClick={() => void loadRoster()} disabled={busy !== null || !selectedBusId} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 disabled:opacity-40"><RefreshCw className={cn("h-3.5 w-3.5", busy === "roster" && "animate-spin")} /> {offline ? "Use cached roster" : "Download roster"}</button>
            <button type="button" onClick={() => void refreshDirectory()} disabled={busy !== null || offline} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 disabled:opacity-40"><RefreshCw className={cn("h-3.5 w-3.5", busy === "directory" && "animate-spin")} /> Refresh</button>
          </div>

          {currentTrip && <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600"><span className="font-semibold text-stone-900">Trip {currentTrip.status}</span><span>{currentTrip.bus.code}</span><span>{currentTrip.direction.replace("_", " ")}</span><span>{currentTrip._count?.events ?? 0} events</span>{currentTrip.status === "OPEN" && <button type="button" onClick={() => void closeTrip()} disabled={busy !== null || offline} className="ml-auto rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-700 disabled:opacity-40">Close trip</button>}</div>}

          {trips.length > 0 && <label className="mt-4 block space-y-1.5 text-xs font-semibold text-stone-600">Existing trip
            <select value={tripId} onChange={(e) => setTripFromSelection(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500"><option value="">Select an open trip</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.bus.code} · {trip.serviceDate.slice(0, 10)} · {trip.direction.replace("_", " ")} · {trip.status}</option>)}</select>
          </label>}

          {!buses.length && <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><p className="font-semibold">No bus assigned to you yet.</p><p className="mt-1">Contact admin to assign a bus to your driver account. You will then see it here.</p></div>}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Current roster</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">Pickup order</h2>
          {roster && rosterKey === currentRosterKey ? <>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">Students</p><p className="mt-1 text-xl font-semibold text-stone-950">{roster.roster.length}</p></div><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">QR ready</p><p className="mt-1 text-xl font-semibold text-stone-950">{roster.roster.filter((e) => e.card).length}</p></div><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">Version</p><p className="mt-1 truncate font-mono text-xs font-semibold text-stone-950">{roster.rosterVersion}</p></div></div>
            {staleLocalRoster && <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Stale roster.</b> Still usable. Sync will flag version.</span></div>}
            {(roster.stopManifest?.length ?? 0) > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Pickup order</span>{roster.stopManifest.map((row) => <span key={row.stopId ?? "no-stop"} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700">{row.stopId ? <MapPin className="h-3 w-3 text-stone-400" /> : <Users className="h-3 w-3 text-amber-500" />}{row.sequence !== null ? `${row.sequence}. ` : ""}{row.stopName}<b className="font-semibold text-stone-950">{row.studentCount}</b></span>)}</div>}
            <div className="mt-4 overflow-hidden rounded-xl border border-stone-100"><div className="max-h-[28rem] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Stop</th><th className="px-3 py-2">Boarded</th></tr></thead><tbody className="divide-y divide-stone-100">{roster.roster.map((entry) => {
              const boarded = boardedKeys.has(`${tripId}:${entry.student.id}`)
              return <tr key={entry.student.id} className={boarded ? "bg-emerald-50/60" : ""}><td className="px-3 py-2.5"><p className="font-semibold text-stone-900">{entry.student.studentName}</p><p className="font-mono text-[10px] text-stone-400">{entry.student.studentId}</p></td><td className="px-3 py-2.5 text-stone-500">{entry.stop ? `${entry.stop.sequence}. ${entry.stop.name}` : <span className="text-stone-300">—</span>}</td><td className="px-3 py-2.5">{boarded ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> yes</span> : <span className="text-stone-400">—</span>}</td></tr>
            })}</tbody></table></div></div>
          </> : <div className="mt-8 rounded-xl border border-dashed border-stone-200 p-8 text-center"><ScanLine className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-semibold text-stone-800">No roster loaded</p><p className="mt-1 text-xs leading-5 text-stone-500">Open a trip, download roster while online, then switch offline. Cached roster survives refresh.</p></div>}
        </section>
      </div>

      {/* Scanner */}
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Scanner</p><h2 className="mt-1 text-xl font-semibold text-stone-950">Capture without network</h2><p className="mt-2 max-w-xl text-xs leading-5 text-stone-500">Writes only to local queue. Sync separately.</p></div><div className={cn("rounded-xl border px-3 py-2 text-right", offline ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}><p className="text-[10px] uppercase tracking-wider text-stone-500">mode</p><p className="mt-0.5 text-sm font-bold">{offline ? "OFFLINE" : "ONLINE"}</p></div></div>
          {!tripId || !roster ? <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><p className="font-semibold">Prepare device context first.</p><p className="mt-1 text-xs leading-5">Open trip and download roster while online, then flip Offline.</p></div> : <>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">Active trip</p><p className="mt-1 text-sm font-semibold text-stone-900">{selectedBus?.code ?? roster.bus.code} · {direction.replace("_", " ")}</p><p className="mt-0.5 text-xs text-stone-500">{serviceDate} · {deviceCode}</p></div><button type="button" onClick={() => void syncQueue()} disabled={busy !== null || offline || !queue.length} className="inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-xs font-semibold text-white disabled:opacity-40"><CloudUpload className="h-4 w-4" /> {busy === "sync" ? "Syncing…" : `Sync ${queue.length}`}</button></div>
            <div className="mt-5 rounded-xl border border-stone-200 p-4"><div className="flex items-center gap-2"><QrCode className="h-4 w-4 text-stone-500" /><p className="text-xs font-semibold text-stone-800">Paste QR token</p></div><div className="mt-3 flex gap-2"><input value={scanValue} onChange={(e) => setScanValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") queueScan(scanValue) }} placeholder="tr1.… token" className="h-11 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 font-mono text-xs outline-none focus:border-stone-500" /><button type="button" onClick={() => queueScan(scanValue)} className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-4 text-xs font-semibold text-white"><ScanLine className="h-3.5 w-3.5" /> Scan</button></div></div>
            <div className="mt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-stone-900">Quick scan from roster</h3><span className="text-[11px] text-stone-400">{roster.roster.length} assigned</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{roster.roster.slice(0, 10).map((entry) => <button key={entry.student.id} type="button" onClick={() => entry.card && queueScan(entry.card.qrToken)} disabled={!entry.card || boardedKeys.has(`${tripId}:${entry.student.id}`)} className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2.5 text-left transition hover:border-stone-400 disabled:opacity-40"><span><span className="block text-xs font-semibold text-stone-900">{entry.student.studentName}</span><span className="block font-mono text-[10px] text-stone-400">{entry.student.studentId}</span></span><QrCode className="h-4 w-4 text-stone-400" /></button>)}</div></div>
          </>}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Exception path</p><h2 className="mt-1 text-xl font-semibold text-stone-950">Manual boarding</h2><p className="mt-2 text-xs leading-5 text-stone-500">Only when card unreadable. Requires reason.</p></div><FileWarning className="h-5 w-5 text-stone-400" /></div><div className="mt-5 space-y-3"><select value={manualStudentId} onChange={(e) => setManualStudentId(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-stone-500"><option value="">Choose student from roster</option>{roster?.roster.map((entry) => <option key={entry.student.id} value={entry.student.id}>{entry.student.studentName} · {entry.student.studentId}</option>)}</select><textarea value={manualReason} onChange={(e) => setManualReason(e.target.value)} className="min-h-20 w-full rounded-lg border border-stone-200 p-3 text-xs outline-none focus:border-stone-500" placeholder="Reason" /><button type="button" onClick={queueManualBoarding} disabled={!tripId || !manualStudentId} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-xs font-semibold text-stone-800 disabled:opacity-40">Capture manual event locally</button></div><div className="mt-8 rounded-xl bg-stone-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Local acknowledgement</p><p className="mt-2 text-sm font-semibold text-stone-900">{queue.length} event{queue.length === 1 ? "" : "s"} waiting</p><p className="mt-1 text-xs leading-5 text-stone-500">Reload page: queue restores from local storage.</p></div></section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Durable local queue</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Pending batch events</h2></div><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">{queue.length} pending</span></div>{lastSync && <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950"><b>Last sync:</b> {lastSync.acceptedCount} accepted · {lastSync.duplicateCount} duplicate · {lastSync.rejectedCount} rejected · {lastSync.warningCount} warnings.</div>}<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Captured</th><th className="px-3 py-2">Local result</th><th className="px-3 py-2">Client event id</th></tr></thead><tbody className="divide-y divide-stone-100">{queue.length ? queue.map((item) => <tr key={item.clientEventId}><td className="px-3 py-3"><p className="font-semibold text-stone-900">{item.studentName}</p><p className="font-mono text-[10px] text-stone-400">{item.publicStudentId}</p></td><td className="px-3 py-3 text-stone-500">{prettyDate(item.deviceCapturedAt)}</td><td className="px-3 py-3">{item.lastResult ? <span className="text-rose-700">{item.lastResult}</span> : <span className="text-amber-700">pending</span>}</td><td className="px-3 py-3 font-mono text-[10px] text-stone-400">{item.clientEventId}</td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-stone-400">No pending events.</td></tr>}</tbody></table></div></section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">My trips report</p><h2 className="mt-1 text-xl font-semibold text-stone-950">Boarding history</h2><p className="mt-2 text-xs leading-5 text-stone-500">Shows only your assigned buses.</p></div><button type="button" onClick={() => void refreshReport()} disabled={busy !== null || offline} className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"><RefreshCw className={cn("h-3.5 w-3.5", busy === "report" && "animate-spin")} /> Load report</button></div>
          {report ? <><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-stone-50 p-4"><p className="text-[10px] uppercase tracking-wider text-stone-400">Total boardings</p><p className="mt-1 text-2xl font-semibold text-stone-950">{report.summary.totalBoardings}</p></div><div className="rounded-xl bg-stone-50 p-4"><p className="text-[10px] uppercase tracking-wider text-stone-400">Unique students</p><p className="mt-1 text-2xl font-semibold text-stone-950">{report.summary.uniqueStudents}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-[10px] uppercase tracking-wider text-amber-700">Exceptions</p><p className="mt-1 text-2xl font-semibold text-amber-950">{report.summary.wrongBusOrUnassigned}</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Bus / direction</th><th className="px-3 py-2">Captured</th><th className="px-3 py-2">Exception</th></tr></thead><tbody className="divide-y divide-stone-100">{report.exceptions.length ? report.exceptions.map((item) => <tr key={item.id}><td className="px-3 py-3"><p className="font-semibold text-stone-900">{item.student.studentName}</p><p className="font-mono text-[10px] text-stone-400">{item.student.studentId}</p></td><td className="px-3 py-3 text-stone-600">{item.bus.code} · {item.direction.replace("_", " ")}</td><td className="px-3 py-3 text-stone-500">{prettyDate(item.deviceCapturedAt)}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" /> {item.assignmentStatus === "UNASSIGNED" ? "Wrong bus / no assignment" : item.code}</span></td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-stone-400">No exceptions in this window.</td></tr>}</tbody></table></div></> : <div className="mt-6 rounded-xl border border-dashed border-stone-200 p-10 text-center"><FileWarning className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-semibold text-stone-800">No report loaded</p><p className="mt-1 text-xs text-stone-500">Sync at least one batch, then load report.</p></div>}
        </section>
      </div>

      {busy && <div className="fixed bottom-5 right-5 z-10 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-lg"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Working…</div>}
    </div>
  )
}
