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
  Milestone,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Settings2,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiClientError } from "@/lib/fetch-with-auth"
import {
  assignTransportStudent,
  assignTransportBusDriver,
  createTransportBus,
  createTransportRoute,
  createTransportStop,
  getTransportBuses,
  getTransportDrivers,
  getTransportRoutes,
  getTransportReport,
  getTransportRoster,
  getTransportStudents,
  getTransportTrips,
  issueTransportCard,
  openTransportTrip,
  syncTransportBatch,
  updateTransportRoute,
  updateTransportStop,
  updateTransportTripStatus,
  type TransportBus,
  type TransportDirection,
  type TransportDriver,
  type TransportReport,
  type TransportRoster,
  type TransportRoute,
  type TransportStop,
  type TransportStudent,
  type TransportSyncResponse,
  type TransportTrip,
} from "@/lib/api/transport"

const STORAGE_KEY = "sms.transport.scanner-simulator.v1"

type FeedbackKind = "success" | "warning" | "error" | "info"

type Feedback = {
  kind: FeedbackKind
  title: string
  detail: string
}

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

type PersistedSimulator = {
  offline: boolean
  deviceCode: string
  serviceDate: string
  direction: TransportDirection
  selectedBusId: string
  tripId: string
  roster: TransportRoster | null
  rosterKey: string
  knownStudents: TransportStudent[]
  queue: QueueItem[]
  boardedKeys: string[]
  scanLog: Feedback[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function tomorrow(): string {
  const date = new Date(`${today()}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
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

function readPersisted(): Partial<PersistedSimulator> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Partial<PersistedSimulator> : null
  } catch {
    return null
  }
}

export function TransportDashboard() {
  const persisted = React.useMemo(() => readPersisted(), [])
  const [hydrated, setHydrated] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"control" | "routes" | "drivers" | "scanner" | "reports">("control")
  const [offline, setOffline] = React.useState(persisted?.offline ?? false)
  const [deviceCode, setDeviceCode] = React.useState(persisted?.deviceCode ?? "browser-simulator-01")
  const [serviceDate, setServiceDate] = React.useState(persisted?.serviceDate ?? today())
  const [direction, setDirection] = React.useState<TransportDirection>(persisted?.direction ?? "TO_SCHOOL")
  const [buses, setBuses] = React.useState<TransportBus[]>([])
  const [students, setStudents] = React.useState<TransportStudent[]>(persisted?.knownStudents ?? [])
  const [trips, setTrips] = React.useState<TransportTrip[]>([])
  const [selectedBusId, setSelectedBusId] = React.useState(persisted?.selectedBusId ?? "")
  const [tripId, setTripId] = React.useState(persisted?.tripId ?? "")
  const [roster, setRoster] = React.useState<TransportRoster | null>(persisted?.roster ?? null)
  const [rosterKey, setRosterKey] = React.useState(persisted?.rosterKey ?? "")
  const [queue, setQueue] = React.useState<QueueItem[]>(persisted?.queue ?? [])
  const [boardedKeys, setBoardedKeys] = React.useState<Set<string>>(
    new Set(persisted?.boardedKeys ?? [])
  )
  const [scanLog, setScanLog] = React.useState<Feedback[]>(persisted?.scanLog ?? [])
  const [feedback, setFeedback] = React.useState<Feedback | null>(null)
  const [lastSync, setLastSync] = React.useState<TransportSyncResponse | null>(null)
  const [report, setReport] = React.useState<TransportReport | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [newBusCode, setNewBusCode] = React.useState("")
  const [newBusRegistration, setNewBusRegistration] = React.useState("")
  const [newBusCapacity, setNewBusCapacity] = React.useState("")
  const [routes, setRoutes] = React.useState<TransportRoute[]>([])
  const [drivers, setDrivers] = React.useState<TransportDriver[]>([])
  const [assignDriverBusId, setAssignDriverBusId] = React.useState("")
  const [assignDriverId, setAssignDriverId] = React.useState("")
  const [selectedRouteId, setSelectedRouteId] = React.useState("")
  const [newRouteCode, setNewRouteCode] = React.useState("")
  const [newRouteName, setNewRouteName] = React.useState("")
  const [newStopName, setNewStopName] = React.useState("")
  // Assignment stop picker. The API derives the route from the stop, so only the
  // stop id is sent; the route select exists purely to narrow the stop list.
  const [assignRouteId, setAssignRouteId] = React.useState("")
  const [assignStopId, setAssignStopId] = React.useState("")
  const [selectedStudentId, setSelectedStudentId] = React.useState("")
  const [studentSearch, setStudentSearch] = React.useState("")
  const [scanValue, setScanValue] = React.useState("")
  const [manualStudentId, setManualStudentId] = React.useState("")
  const [manualReason, setManualReason] = React.useState("Offline identity confirmation")

  const currentTrip = trips.find((trip) => trip.id === tripId) ?? null
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? null
  const selectedBus = buses.find((bus) => bus.id === selectedBusId) ?? null
  const currentRosterKey = makeRosterKey(selectedBusId, serviceDate, direction)
  const staleLocalRoster = Boolean(
    roster &&
    rosterKey === currentRosterKey &&
    Date.now() - new Date(roster.generatedAt).getTime() > roster.staleAfterHours * 60 * 60 * 1000
  )

  const persistState = React.useCallback(() => {
    if (!hydrated || typeof window === "undefined") return
    const snapshot: PersistedSimulator = {
      offline,
      deviceCode,
      serviceDate,
      direction,
      selectedBusId,
      tripId,
      roster,
      rosterKey,
      knownStudents: students,
      queue,
      boardedKeys: Array.from(boardedKeys),
      scanLog: scanLog.slice(0, 20),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }, [boardedKeys, deviceCode, direction, hydrated, offline, queue, roster, rosterKey, scanLog, selectedBusId, serviceDate, students, tripId])

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    persistState()
  }, [persistState])

  const addFeedback = React.useCallback((next: Feedback) => {
    setFeedback(next)
    setScanLog((previous) => [next, ...previous].slice(0, 20))
  }, [])

  const refreshDirectory = React.useCallback(async () => {
    if (offline) return
    setBusy("directory")
    setLoadError(null)
    try {
      const [busData, studentData, tripData, routeData, driverData] = await Promise.all([
        getTransportBuses(),
        getTransportStudents(studentSearch || undefined),
        getTransportTrips(serviceDate),
        getTransportRoutes(),
        getTransportDrivers().catch(() => [] as TransportDriver[]),
      ])
      setBuses(busData)
      setStudents(studentData)
      setTrips(tripData)
      setRoutes(routeData)
      setDrivers(driverData as TransportDriver[])
      setSelectedBusId((current) => current || busData[0]?.id || "")
      if (!tripId) {
        const matchingTrip = tripData.find((trip) => trip.busId === (selectedBusId || busData[0]?.id) && trip.direction === direction)
        if (matchingTrip) setTripId(matchingTrip.id)
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Transport data could not be loaded.")
    } finally {
      setBusy(null)
    }
  }, [direction, offline, selectedBusId, serviceDate, studentSearch, tripId])

  React.useEffect(() => {
    if (hydrated && !offline) void refreshDirectory()
  }, [hydrated, offline, refreshDirectory])

  const loadRoster = React.useCallback(async () => {
    if (!selectedBusId) {
      addFeedback({ kind: "error", title: "Choose a bus first", detail: "The scanner roster is scoped to a bus and service date." })
      return
    }
    const key = makeRosterKey(selectedBusId, serviceDate, direction)
    if (offline) {
      if (roster && rosterKey === key) {
        addFeedback({
          kind: staleLocalRoster ? "warning" : "info",
          title: staleLocalRoster ? "Using a stale local roster" : "Local roster ready",
          detail: staleLocalRoster
            ? "Scanning remains enabled. The next sync will include the stored roster version so the server can flag changes."
            : "No network request was made. This roster came from the persisted simulator cache.",
        })
      } else {
        addFeedback({ kind: "error", title: "No cached roster", detail: "Load this bus roster once while online before testing offline scanning." })
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
        title: next.isVersionStale ? "Roster changed since the cached copy" : "Roster downloaded",
        detail: `${next.roster.length} student(s) available offline. ${next.isVersionStale ? "The old copy remains usable." : "The simulator can now scan without a network request."}`,
      })
    } catch (error) {
      addFeedback({ kind: "error", title: "Roster download failed", detail: error instanceof Error ? error.message : "Try again while online." })
    } finally {
      setBusy(null)
    }
  }, [addFeedback, direction, offline, roster, rosterKey, selectedBusId, serviceDate, staleLocalRoster])

  const openTrip = async (reopen = false) => {
    if (!selectedBusId) {
      addFeedback({ kind: "error", title: "Choose a bus first", detail: "A trip is unique per bus, date, and direction." })
      return
    }
    if (offline) {
      addFeedback({ kind: "warning", title: "Trip start needs connectivity", detail: "Open the trip before switching the simulator to offline mode." })
      return
    }
    setBusy("trip")
    try {
      const next = await openTransportTrip({ busId: selectedBusId, serviceDate, direction, reopen })
      setTrips((previous) => [next, ...previous.filter((trip) => trip.id !== next.id)])
      setTripId(next.id)
      addFeedback({
        kind: "success",
        title: reopen ? "Trip reopened" : "Trip is open",
        detail: `${next.bus.code} · ${direction.replace("_", " ")} · ${serviceDate}`,
      })
    } catch (error) {
      // 409 means a CLOSED or CANCELLED trip already exists for this bus, date
      // and direction. Reopening clears its endedAt, so it is confirmed here
      // rather than happening silently on a retry or a double-click.
      if (!reopen && error instanceof ApiClientError && error.statusCode === 409) {
        setBusy(null)
        if (
          window.confirm(
            "This trip is already closed or cancelled.\n\nReopen it? Its recorded close time will be cleared.",
          )
        ) {
          await openTrip(true)
        }
        return
      }
      addFeedback({ kind: "error", title: "Trip could not be opened", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const createBus = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newBusCode.trim()) return
    setBusy("bus")
    try {
      const bus = await createTransportBus({
        code: newBusCode.trim(),
        registrationNumber: newBusRegistration.trim() || null,
        capacity: newBusCapacity ? Number(newBusCapacity) : null,
      })
      setBuses((previous) => [...previous, bus].sort((a, b) => a.code.localeCompare(b.code)))
      setSelectedBusId(bus.id)
      setNewBusCode("")
      setNewBusRegistration("")
      setNewBusCapacity("")
      addFeedback({ kind: "success", title: "Bus created", detail: `${bus.code} is ready for roster setup.` })
    } catch (error) {
      addFeedback({ kind: "error", title: "Bus could not be created", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const assignDriver = async () => {
    if (!assignDriverBusId) {
      addFeedback({ kind: "error", title: "Choose a bus", detail: "Select a bus to assign a driver to." })
      return
    }
    setBusy("driver")
    try {
      const updated = await assignTransportBusDriver(assignDriverBusId, assignDriverId || null)
      setBuses((prev) => prev.map((b) => (b.id === updated.id ? { ...b, driver: updated.driver, driverStaffId: updated.driverStaffId } : b)))
      addFeedback({
        kind: "success",
        title: assignDriverId ? "Driver assigned" : "Driver unassigned",
        detail: assignDriverId ? `${updated.code} now driven by ${updated.driver?.staffName ?? "driver"}. Driver will see this bus in their portal.` : `${updated.code} has no driver now.`,
      })
    } catch (error) {
      addFeedback({ kind: "error", title: "Driver assignment failed", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const reloadRoutes = React.useCallback(async () => {
    try {
      const [routeData, driverData] = await Promise.all([getTransportRoutes(), getTransportDrivers().catch(() => [] as TransportDriver[])])
      setRoutes(routeData)
      setDrivers(driverData as TransportDriver[])
    } catch {
      // Non-fatal: the control room still works without the route registry.
    }
  }, [])

  const createRoute = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newRouteCode.trim() || !newRouteName.trim()) return
    setBusy("route")
    try {
      const created = await createTransportRoute({ code: newRouteCode.trim(), name: newRouteName.trim() })
      setNewRouteCode("")
      setNewRouteName("")
      setSelectedRouteId(created.id)
      await reloadRoutes()
      addFeedback({ kind: "success", title: "Route created", detail: `${created.code} · ${created.name}. Now add its stops in pickup order.` })
    } catch (error) {
      addFeedback({ kind: "error", title: "Route not created", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const addStop = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedRouteId || !newStopName.trim()) return
    setBusy("stop")
    try {
      const created = await createTransportStop(selectedRouteId, { name: newStopName.trim() })
      setNewStopName("")
      await reloadRoutes()
      addFeedback({ kind: "success", title: "Stop added", detail: `${created.name} appended at position ${created.sequence}.` })
    } catch (error) {
      addFeedback({ kind: "error", title: "Stop not added", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const retireRoute = async (route: TransportRoute) => {
    setBusy("route")
    try {
      await updateTransportRoute(route.id, { isActive: false })
      if (selectedRouteId === route.id) setSelectedRouteId("")
      setAssignRouteId("")
      setAssignStopId("")
      await reloadRoutes()
      addFeedback({ kind: "success", title: "Route retired", detail: `${route.code} left the active list. Children already assigned to a bus keep travelling.` })
    } catch (error) {
      addFeedback({ kind: "error", title: "Route not retired", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const toggleStop = async (stop: TransportStop) => {
    setBusy("stop")
    try {
      await updateTransportStop(stop.id, { isActive: !stop.isActive })
      if (stop.isActive && assignStopId === stop.id) setAssignStopId("")
      await reloadRoutes()
      addFeedback({
        kind: "success",
        title: stop.isActive ? "Stop deactivated" : "Stop reactivated",
        detail: stop.isActive ? `${stop.name} is no longer offered to new assignments; existing ones keep it.` : `${stop.name} is available again.`,
      })
    } catch (error) {
      addFeedback({ kind: "error", title: "Stop not updated", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const assignStudent = async () => {
    if (!selectedStudentId || !selectedBusId) return
    setBusy("assignment")
    try {
      await assignTransportStudent({
        studentId: selectedStudentId,
        busId: selectedBusId,
        stopId: assignStopId || null,
        effectiveFrom: `${serviceDate}T00:00:00.000Z`,
      })
      const stopName = assignStopId
        ? routes.flatMap((route) => route.stops ?? []).find((stop) => stop.id === assignStopId)?.name ?? null
        : null
      addFeedback({
        kind: "success",
        title: "Roster assignment saved",
        detail: stopName
          ? `Assigned to stop “${stopName}”. Download the roster again to make it available offline.`
          : "Download the roster again to make this assignment available offline.",
      })
      if (!offline) await loadRoster()
    } catch (error) {
      addFeedback({ kind: "error", title: "Assignment failed", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const issueCard = async () => {
    if (!selectedStudentId) return
    setBusy("card")
    try {
      await issueTransportCard({ studentId: selectedStudentId, replaceExisting: true })
      addFeedback({ kind: "success", title: "Opaque QR token issued", detail: "The token contains no student personal data. Download the roster again to cache it." })
      if (!offline) {
        const studentData = await getTransportStudents(studentSearch || undefined)
        setStudents(studentData)
        await loadRoster()
      }
    } catch (error) {
      addFeedback({ kind: "error", title: "Card could not be issued", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const setTripFromSelection = (nextTripId: string) => {
    setTripId(nextTripId)
    const nextTrip = trips.find((trip) => trip.id === nextTripId)
    if (nextTrip) {
      setSelectedBusId(nextTrip.busId)
      setServiceDate(nextTrip.serviceDate.slice(0, 10))
      setDirection(nextTrip.direction)
    }
  }

  const queueScan = (token: string, source: "QR" | "MANUAL" = "QR", manualStudent?: TransportStudent) => {
    const value = token.trim()
    if (!value) {
      addFeedback({ kind: "error", title: "Nothing to scan", detail: "Paste an opaque QR token or use one of the roster buttons." })
      return
    }
    if (!tripId) {
      addFeedback({ kind: "error", title: "No open trip selected", detail: "Open a trip while online before starting an offline scan session." })
      return
    }

    const rosterEntry = roster?.roster.find((entry) => entry.card?.qrToken === value)
    const knownStudent = manualStudent ?? students.find((student) => student.transportCards?.some((card) => card.qrToken === value))
    const studentId = rosterEntry?.student.id ?? knownStudent?.id
    const studentName = rosterEntry?.student.studentName ?? knownStudent?.studentName
    const publicStudentId = rosterEntry?.student.studentId ?? knownStudent?.studentId

    if (!studentId || !studentName || !publicStudentId) {
      addFeedback({ kind: "error", title: "Invalid QR token", detail: "The simulator could not match this token to its cached directory. No network request was made and nothing was queued." })
      return
    }

    const boardingKey = `${tripId}:${studentId}`
    if (boardedKeys.has(boardingKey) || queue.some((item) => `${item.tripId}:${item.studentId}` === boardingKey)) {
      addFeedback({ kind: "info", title: "Duplicate scan", detail: `${studentName} already has a local boarding event for this trip.` })
      return
    }

    const isWrongBus = !rosterEntry
    const item: QueueItem = {
      clientEventId: makeId(),
      tripId,
      qrToken: source === "QR" ? value : null,
      studentId,
      studentName,
      publicStudentId,
      source,
      deviceCapturedAt: new Date().toISOString(),
      rosterVersion: roster?.rosterVersion ?? null,
      manualReason: source === "MANUAL" ? manualReason.trim() || "Manual identity confirmation" : null,
      ...(isWrongBus ? { localWarning: "WRONG_BUS" } : {}),
    }
    setQueue((previous) => [item, ...previous])
    setBoardedKeys((previous) => new Set(previous).add(boardingKey))
    setScanValue("")
    addFeedback({
      kind: isWrongBus ? "warning" : "success",
      title: isWrongBus ? "Captured — wrong-bus warning" : "Captured offline",
      detail: `${studentName} was acknowledged locally. The event is queued and will be flagged by the server if the current assignment belongs to another bus.`,
    })
  }

  const queueManualBoarding = () => {
    const student = students.find((candidate) => candidate.id === manualStudentId)
    if (!student) {
      addFeedback({ kind: "error", title: "Choose a student", detail: "Manual boarding is an exception path and requires a reason." })
      return
    }
    queueScan("manual", "MANUAL", student)
  }

  const syncQueue = async () => {
    if (offline) {
      addFeedback({ kind: "warning", title: "Simulator is offline", detail: "Turn off offline mode to send one batch. Scans remain in local storage." })
      return
    }
    if (!queue.length) {
      addFeedback({ kind: "info", title: "Queue is empty", detail: "Capture a few scans first. Scanning itself does not call the network." })
      return
    }
    const syncItems = queue.filter((item) => item.tripId === tripId)
    if (!syncItems.length) {
      addFeedback({ kind: "warning", title: "Select the queued trip", detail: "This queue contains events for another trip." })
      return
    }

    setBusy("sync")
    try {
      const response = await syncTransportBatch({
        batchId: makeId(),
        deviceCode: deviceCode.trim() || "browser-simulator-01",
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
      const resultById = new Map(response.results.map((result) => [result.clientEventId, result]))
      setQueue((previous) => previous
        .map((item) => {
          const result = resultById.get(item.clientEventId)
          return result?.status === "REJECTED"
            ? { ...item, lastResult: `${result.code}${result.warnings.length ? ` · ${result.warnings.join(", ")}` : ""}` }
            : item
        })
        .filter((item) => {
          const result = resultById.get(item.clientEventId)
          return !result || result.status === "REJECTED"
        }))
      for (const item of syncItems) {
        const result = resultById.get(item.clientEventId)
        if (result?.status === "REJECTED") {
          setBoardedKeys((previous) => {
            const next = new Set(previous)
            next.delete(`${item.tripId}:${item.studentId}`)
            return next
          })
        }
      }
      addFeedback({
        kind: response.rejectedCount ? "warning" : "success",
        title: `Batch synced · ${response.acceptedCount} accepted`,
        detail: `${response.duplicateCount} duplicate, ${response.rejectedCount} rejected, ${response.warningCount} warning result(s). Retry keeps the same client event ids and is safe.`
      })
    } catch (error) {
      addFeedback({ kind: "error", title: "Batch sync failed", detail: `${error instanceof Error ? error.message : "Network unavailable."} The local queue was kept intact.` })
    } finally {
      setBusy(null)
    }
  }

  const refreshReport = async () => {
    if (offline) {
      addFeedback({ kind: "info", title: "Reports need connectivity", detail: "The scanner queue remains available offline; server reporting is read after sync." })
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
    } catch (error) {
      addFeedback({ kind: "error", title: "Report could not be loaded", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const closeTrip = async () => {
    if (!tripId || offline) return
    setBusy("close-trip")
    try {
      const next = await updateTransportTripStatus(tripId, "CLOSED")
      setTrips((previous) => previous.map((trip) => trip.id === next.id ? next : trip))
      addFeedback({ kind: "success", title: "Trip closed", detail: "New events are rejected; retries for already-synced client event ids remain idempotent." })
    } catch (error) {
      addFeedback({ kind: "error", title: "Trip could not be closed", detail: error instanceof Error ? error.message : "Try again." })
    } finally {
      setBusy(null)
    }
  }

  const knownCardsOutsideRoster = students
    .filter((student) => student.transportCards?.length && !roster?.roster.some((entry) => entry.student.id === student.id))
    .slice(0, 8)

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-col gap-4 border-b border-stone-200 pb-5 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            <BusFront className="h-3.5 w-3.5" /> Transport control room
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Offline-first boarding</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
            Prepare one bus trip, download its roster once, then exercise the same durable batch contract used by the future Android scanner.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOffline((value) => !value)}
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

      <div className="flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
        {(["control", "routes", "drivers", "scanner", "reports"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn("rounded-lg px-4 py-2 text-xs font-semibold capitalize transition", activeTab === tab ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:text-stone-900")}>
            {tab === "control" ? "Control room" : tab === "routes" ? "Routes & stops" : tab === "drivers" ? "Drivers & buses" : tab === "scanner" ? "Scanner simulator" : "Exceptions & reports"}
          </button>
        ))}
      </div>

      {activeTab === "control" && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Trip setup</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Choose the scanner context</h2></div>
                <Settings2 className="h-5 w-5 text-stone-400" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-stone-600">Bus
                  <select value={selectedBusId} onChange={(event) => setSelectedBusId(event.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500">
                    <option value="">Select a bus</option>{buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.code}{bus.registrationNumber ? ` · ${bus.registrationNumber}` : ""}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-stone-600">Service date
                  <input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500" />
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-stone-600">Direction
                  <select value={direction} onChange={(event) => setDirection(event.target.value as TransportDirection)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500">
                    <option value="TO_SCHOOL">To school</option><option value="FROM_SCHOOL">From school</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-stone-600">Device code
                  <input value={deviceCode} onChange={(event) => setDeviceCode(event.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500" />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void openTrip()} disabled={busy !== null || offline || !selectedBusId} className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-3.5 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><BusFront className="h-3.5 w-3.5" /> {busy === "trip" ? "Opening…" : "Open trip"}</button>
                <button type="button" onClick={() => void loadRoster()} disabled={busy !== null || !selectedBusId} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className={cn("h-3.5 w-3.5", busy === "roster" && "animate-spin")} /> {offline ? "Use cached roster" : "Download roster"}</button>
                <button type="button" onClick={() => void refreshDirectory()} disabled={busy !== null || offline} className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className={cn("h-3.5 w-3.5", busy === "directory" && "animate-spin")} /> Refresh</button>
              </div>
              {currentTrip && <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600"><span className="font-semibold text-stone-900">Trip {currentTrip.status}</span><span>{currentTrip.bus.code}</span><span>{currentTrip.direction.replace("_", " ")}</span><span>{currentTrip._count?.events ?? 0} server events</span>{currentTrip.status === "OPEN" && <button type="button" onClick={() => void closeTrip()} disabled={busy !== null || offline} className="ml-auto rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-700 disabled:opacity-40">Close trip</button>}</div>}
              {trips.length > 0 && <label className="mt-4 block space-y-1.5 text-xs font-semibold text-stone-600">Existing trip
                <select value={tripId} onChange={(event) => setTripFromSelection(event.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500"><option value="">Select an open trip</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.bus.code} · {trip.serviceDate.slice(0, 10)} · {trip.direction.replace("_", " ")} · {trip.status}</option>)}</select>
              </label>}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Roster preparation</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Assign students and issue cards</h2></div><Users className="h-5 w-5 text-stone-400" /></div>
              <p className="mt-2 text-xs leading-5 text-stone-500">These are administrative setup actions. The scanner simulator only reads the downloaded roster and writes to local storage while offline.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-stone-500"><option value="">Choose an active student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.studentName} · {student.studentId}</option>)}</select>
                <select value={assignRouteId} onChange={(event) => { setAssignRouteId(event.target.value); setAssignStopId("") }} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-stone-500"><option value="">Route (optional)</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.code} · {route.name}</option>)}</select>
                <select value={assignStopId} onChange={(event) => setAssignStopId(event.target.value)} disabled={!assignRouteId} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:cursor-not-allowed disabled:opacity-40"><option value="">Stop (optional)</option>{(routes.find((route) => route.id === assignRouteId)?.stops ?? []).filter((stop) => stop.isActive).map((stop) => <option key={stop.id} value={stop.id}>{stop.sequence}. {stop.name}</option>)}</select>
                <button type="button" onClick={() => void assignStudent()} disabled={!selectedStudentId || !selectedBusId || busy !== null || offline} className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-800 disabled:opacity-40">{assignStopId ? "Assign to stop" : "Assign to bus"}</button>
                <button type="button" onClick={() => void issueCard()} disabled={!selectedStudentId || busy !== null || offline} className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><QrCode className="h-3.5 w-3.5" /> Issue QR</button>
              </div>
              <div className="mt-4 flex items-center gap-2"><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search students before refreshing" className="h-9 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 text-xs outline-none focus:border-stone-500" /><button type="button" onClick={() => void refreshDirectory()} disabled={busy !== null || offline} className="h-9 rounded-lg border border-stone-200 px-3 text-xs font-semibold text-stone-700 disabled:opacity-40">Search</button></div>
              {!buses.length && <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><p className="font-semibold">Create the first bus to begin.</p><p className="mt-1">The web simulator does not fabricate production roster data. Add a real bus, assign real active students, issue opaque cards, then download the roster.</p></div>}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Current roster</p><h2 className="mt-1 text-lg font-semibold text-stone-950">What the device can use offline</h2></div><ScanLine className="h-5 w-5 text-stone-400" /></div>
            {roster && rosterKey === currentRosterKey ? <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">Students</p><p className="mt-1 text-xl font-semibold text-stone-950">{roster.roster.length}</p></div><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">QR ready</p><p className="mt-1 text-xl font-semibold text-stone-950">{roster.roster.filter((entry) => entry.card).length}</p></div><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">Roster age</p><p className="mt-1 text-sm font-semibold text-stone-950">{prettyDate(roster.generatedAt)}</p></div><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">Version</p><p className="mt-1 truncate font-mono text-xs font-semibold text-stone-950">{roster.rosterVersion}</p></div></div>
              {staleLocalRoster && <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Stale roster warning.</b> It remains usable by design. Sync results will carry the old version so the backend can report changes.</span></div>}
              {(roster.stopManifest?.length ?? 0) > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Pickup order</span>{roster.stopManifest.map((row) => <span key={row.stopId ?? "no-stop"} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700">{row.stopId ? <MapPin className="h-3 w-3 text-stone-400" /> : <Users className="h-3 w-3 text-amber-500" />}{row.sequence !== null ? `${row.sequence}. ` : ""}{row.stopName}<b className="font-semibold text-stone-950">{row.studentCount}</b></span>)}</div>}
              <div className="mt-4 overflow-hidden rounded-xl border border-stone-100"><div className="max-h-[28rem] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Stop</th><th className="px-3 py-2">Card</th></tr></thead><tbody className="divide-y divide-stone-100">{roster.roster.map((entry) => <tr key={entry.student.id}><td className="px-3 py-2.5"><p className="font-semibold text-stone-900">{entry.student.studentName}</p><p className="font-mono text-[10px] text-stone-400">{entry.student.studentId}</p></td><td className="px-3 py-2.5 text-stone-500">{entry.student.className ?? "—"}</td><td className="px-3 py-2.5 text-stone-500">{entry.stop ? `${entry.stop.sequence}. ${entry.stop.name}` : <span className="text-stone-300">—</span>}</td><td className="px-3 py-2.5">{entry.card ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> ready</span> : <span className="text-amber-700">No card</span>}</td></tr>)}</tbody></table></div></div>
            </> : <div className="mt-8 rounded-xl border border-dashed border-stone-200 p-8 text-center"><ScanLine className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-semibold text-stone-800">No roster loaded for this context</p><p className="mt-1 text-xs leading-5 text-stone-500">Open a trip, download its roster while online, then switch to Offline mode. The cached roster survives page restart.</p></div>}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Create bus</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Add a vehicle to the transport registry</h2></div><form onSubmit={createBus} className="flex flex-wrap gap-2 sm:justify-end"><input value={newBusCode} onChange={(event) => setNewBusCode(event.target.value)} placeholder="Bus code e.g. BUS-01" className="h-9 w-40 rounded-lg border border-stone-200 px-3 text-xs outline-none focus:border-stone-500" /><input value={newBusRegistration} onChange={(event) => setNewBusRegistration(event.target.value)} placeholder="Registration (optional)" className="h-9 w-44 rounded-lg border border-stone-200 px-3 text-xs outline-none focus:border-stone-500" /><input value={newBusCapacity} onChange={(event) => setNewBusCapacity(event.target.value)} type="number" min="1" placeholder="Capacity" className="h-9 w-24 rounded-lg border border-stone-200 px-3 text-xs outline-none focus:border-stone-500" /><button type="submit" disabled={busy !== null || offline} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-950 px-3 text-xs font-semibold text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Add bus</button></form></div></section>
        </div>
      )}

      {activeTab === "routes" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Route registry</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Routes outlive the buses running them</h2></div>
              <Milestone className="h-5 w-5 text-stone-400" />
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">Assign a child to a stop on a route and the vehicle can be swapped, replaced or borrowed without invalidating the assignment. Retiring a route never strands a child — the bus leg of every existing assignment survives.</p>
            <form onSubmit={createRoute} className="mt-4 flex flex-wrap gap-2">
              <input value={newRouteCode} onChange={(event) => setNewRouteCode(event.target.value)} placeholder="Code e.g. R-EAST" className="h-9 w-36 rounded-lg border border-stone-200 px-3 text-xs outline-none focus:border-stone-500" />
              <input value={newRouteName} onChange={(event) => setNewRouteName(event.target.value)} placeholder="Name e.g. East Legon Loop" className="h-9 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 text-xs outline-none focus:border-stone-500" />
              <button type="submit" disabled={busy !== null || offline || !newRouteCode.trim() || !newRouteName.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Add route</button>
            </form>
            <div className="mt-4 space-y-2">
              {routes.length === 0 && <p className="rounded-xl border border-dashed border-stone-200 p-5 text-center text-xs leading-5 text-stone-500">No active routes yet. Children can still be assigned to a bus alone — stops are optional.</p>}
              {routes.map((route) => (
                <div key={route.id} className={cn("rounded-xl border p-3 transition", selectedRouteId === route.id ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-300")}>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setSelectedRouteId(route.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-stone-950">{route.name}</p>
                      <p className="font-mono text-[10px] text-stone-400">{route.code}</p>
                    </button>
                    <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-600">{route._count?.stops ?? route.stops?.length ?? 0} stops</span>
                    <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-600">{route._count?.assignments ?? 0} assigned</span>
                    <button type="button" onClick={() => void retireRoute(route)} disabled={busy !== null || offline} className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-600 hover:text-stone-950 disabled:opacity-40">Retire</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Stops in pickup order</p><h2 className="mt-1 text-lg font-semibold text-stone-950">{selectedRoute ? selectedRoute.name : "Select a route"}</h2></div>
              <MapPin className="h-5 w-5 text-stone-400" />
            </div>
            {selectedRoute ? <>
              <form onSubmit={addStop} className="mt-4 flex flex-wrap gap-2">
                <input value={newStopName} onChange={(event) => setNewStopName(event.target.value)} placeholder="Stop name e.g. Airport City" className="h-9 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 text-xs outline-none focus:border-stone-500" />
                <button type="submit" disabled={busy !== null || offline || !newStopName.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Append stop</button>
              </form>
              <p className="mt-2 text-[11px] leading-4 text-stone-500">Stops append in pickup order. The return trip runs the same list backwards automatically — there is no second order to maintain.</p>
              {(selectedRoute.stops ?? []).length === 0 && <p className="mt-4 rounded-xl border border-dashed border-stone-200 p-5 text-center text-xs text-stone-500">No stops on this route yet.</p>}
              <ol className="mt-4 space-y-2">
                {(selectedRoute.stops ?? []).map((stop) => (
                  <li key={stop.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", stop.isActive ? "bg-stone-950 text-white" : "bg-stone-200 text-stone-500")}>{stop.sequence}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-semibold", stop.isActive ? "text-stone-950" : "text-stone-400 line-through")}>{stop.name}</p>
                      <p className="text-[10px] text-stone-400">{stop.latitude !== null && stop.longitude !== null ? `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}` : "No coordinates"} · {stop._count?.assignments ?? 0} assigned</p>
                    </div>
                    <button type="button" onClick={() => void toggleStop(stop)} disabled={busy !== null || offline} className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-600 hover:text-stone-950 disabled:opacity-40">{stop.isActive ? "Deactivate" : "Reactivate"}</button>
                  </li>
                ))}
              </ol>
            </> : <div className="mt-10 rounded-xl border border-dashed border-stone-200 p-8 text-center"><Milestone className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-semibold text-stone-800">No route selected</p><p className="mt-1 text-xs leading-5 text-stone-500">Create a route or pick one from the list to manage its stops.</p></div>}
          </section>
        </div>
      )}

      
      {activeTab === "drivers" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Driver assignment</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Assign a driver to a bus</h2></div>
              <BusFront className="h-5 w-5 text-stone-400" />
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">Drivers log in with their own account (role DRIVER). Once assigned, they see only their buses in the driver portal — roster in pickup order, trip open/close, offline scan queue.</p>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1.5 text-xs font-semibold text-stone-600">Bus
                <select value={assignDriverBusId} onChange={(e) => setAssignDriverBusId(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500">
                  <option value="">Select bus</option>
                  {buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.code} {bus.driver ? `· ${bus.driver.staffName}` : "· no driver"} {bus.registrationNumber ? `· ${bus.registrationNumber}` : ""}</option>)}
                </select>
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-stone-600">Driver (role DRIVER)
                <select value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal text-stone-900 outline-none focus:border-stone-500">
                  <option value="">— Unassign (no driver) —</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.staffName} · {d.staffId} {d.account ? `· ${d.account.email}` : ""} {d.drivenBuses.length ? `· ${d.drivenBuses.map((b) => b.code).join(", ")}` : ""}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void assignDriver()} disabled={busy !== null || !assignDriverBusId} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-950 px-3 text-xs font-semibold text-white disabled:opacity-40">
                <Users className="h-3.5 w-3.5" /> {assignDriverId ? "Assign driver" : "Unassign driver"}
              </button>
            </div>
            {drivers.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><p className="font-semibold">No drivers found.</p><p className="mt-1">Create a staff account with role DRIVER in Staff &gt; Add staff (set role to DRIVER). They will appear here.</p></div>}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Fleet overview</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Buses and their drivers</h2></div>
              <Users className="h-5 w-5 text-stone-400" />
            </div>
            <div className="mt-4 space-y-2">
              {buses.length === 0 && <p className="rounded-xl border border-dashed border-stone-200 p-5 text-center text-xs text-stone-500">No buses yet.</p>}
              {buses.map((bus) => (
                <div key={bus.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-950 text-white text-xs font-bold">{bus.code.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-950">{bus.code} {bus.registrationNumber ? `· ${bus.registrationNumber}` : ""}</p>
                    <p className="text-[11px] text-stone-500">{bus.driver ? `${bus.driver.staffName} · ${bus.driver.account?.email ?? bus.driver.staffId}` : "No driver assigned"} · {bus._count?.assignments ?? 0} students</p>
                  </div>
                  <button type="button" onClick={() => { setAssignDriverBusId(bus.id); setAssignDriverId(bus.driverStaffId ?? "") }} className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-600 hover:text-stone-950">Select</button>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">How drivers log in</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-stone-600">
                <li>Admin creates staff with role <b>DRIVER</b> (Staff → Add staff → role = DRIVER). Same login page, same auth.</li>
                <li>Assign that driver to a bus here. A driver can drive multiple buses.</li>
                <li>Driver opens <span className="font-mono text-[11px] bg-white border border-stone-200 px-1 rounded">/dashboard/transport</span> and automatically sees driver portal (restricted).</li>
                <li>Driver flow: open trip → download roster (once, while online) → offline scan queue → sync when signal.</li>
              </ul>
            </div>
          </section>
        </div>
      )}

{activeTab === "scanner" && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Browser device emulator</p><h2 className="mt-1 text-xl font-semibold text-stone-950">Capture without a network request</h2><p className="mt-2 max-w-xl text-xs leading-5 text-stone-500">This screen intentionally writes only to the persisted local queue during a scan. Use the sync button separately to send one batch.</p></div><div className={cn("rounded-xl border px-3 py-2 text-right", offline ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}><p className="text-[10px] uppercase tracking-wider text-stone-500">mode</p><p className="mt-0.5 text-sm font-bold">{offline ? "OFFLINE" : "ONLINE"}</p></div></div>
            {!tripId || !roster ? <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><p className="font-semibold">Prepare the device context first.</p><p className="mt-1 text-xs leading-5">From Control room, open a trip and download a roster. Then flip Offline mode on. The simulator will recover this context after a browser refresh.</p></div> : <>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">Active trip</p><p className="mt-1 text-sm font-semibold text-stone-900">{selectedBus?.code ?? roster.bus.code} · {direction.replace("_", " ")}</p><p className="mt-0.5 text-xs text-stone-500">{serviceDate} · {deviceCode}</p></div><button type="button" onClick={() => void syncQueue()} disabled={busy !== null || offline || !queue.length} className="inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><CloudUpload className="h-4 w-4" /> {busy === "sync" ? "Syncing batch…" : `Sync ${queue.length} event${queue.length === 1 ? "" : "s"}`}</button></div>
              <div className="mt-5 rounded-xl border border-stone-200 p-4"><div className="flex items-center gap-2"><QrCode className="h-4 w-4 text-stone-500" /><p className="text-xs font-semibold text-stone-800">Paste a QR token</p></div><div className="mt-3 flex gap-2"><input value={scanValue} onChange={(event) => setScanValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") queueScan(scanValue) }} placeholder="tr1.… signed opaque token" className="h-11 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 font-mono text-xs outline-none focus:border-stone-500" /><button type="button" onClick={() => queueScan(scanValue)} className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-4 text-xs font-semibold text-white"><ScanLine className="h-3.5 w-3.5" /> Scan</button></div><p className="mt-2 text-[11px] text-stone-400">Invalid values are rejected locally. Known cards outside this bus are accepted locally and marked as a wrong-bus exception for batch sync.</p></div>
              <div className="mt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-stone-900">Quick scan from cached directory</h3><span className="text-[11px] text-stone-400">{roster.roster.length} assigned</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{roster.roster.slice(0, 8).map((entry) => <button key={entry.student.id} type="button" onClick={() => entry.card && queueScan(entry.card.qrToken)} disabled={!entry.card} className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2.5 text-left transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40"><span><span className="block text-xs font-semibold text-stone-900">{entry.student.studentName}</span><span className="block font-mono text-[10px] text-stone-400">{entry.student.studentId}</span></span><QrCode className="h-4 w-4 text-stone-400" /></button>)}</div></div>
              {knownCardsOutsideRoster.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-700" /><h3 className="text-sm font-semibold text-amber-950">Wrong-bus test cards</h3></div><p className="mt-1 text-xs leading-5 text-amber-900">These cached active cards are not on the selected bus roster. Scanning one is allowed and queues an exception; it is not blocked.</p><div className="mt-3 flex flex-wrap gap-2">{knownCardsOutsideRoster.map((student) => <button key={student.id} type="button" onClick={() => student.transportCards?.[0] && queueScan(student.transportCards[0].qrToken)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-left text-xs font-semibold text-amber-950">{student.studentName}<span className="ml-1 font-mono text-[10px] font-normal">· wrong bus</span></button>)}</div></div>}
            </>}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Exception path</p><h2 className="mt-1 text-xl font-semibold text-stone-950">Manual boarding</h2><p className="mt-2 text-xs leading-5 text-stone-500">Use only when a card is unreadable. It still queues offline and requires a reason.</p></div><FileWarning className="h-5 w-5 text-stone-400" /></div><div className="mt-5 space-y-3"><select value={manualStudentId} onChange={(event) => setManualStudentId(event.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-stone-500"><option value="">Choose student for manual boarding</option>{students.map((student) => <option key={student.id} value={student.id}>{student.studentName} · {student.studentId}</option>)}</select><textarea value={manualReason} onChange={(event) => setManualReason(event.target.value)} className="min-h-20 w-full rounded-lg border border-stone-200 p-3 text-xs outline-none focus:border-stone-500" placeholder="Reason" /><button type="button" onClick={queueManualBoarding} disabled={!tripId || !manualStudentId} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-xs font-semibold text-stone-800 disabled:opacity-40">Capture manual event locally</button></div><div className="mt-8 rounded-xl bg-stone-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Local acknowledgement</p><p className="mt-2 text-sm font-semibold text-stone-900">{queue.length} event{queue.length === 1 ? "" : "s"} waiting</p><p className="mt-1 text-xs leading-5 text-stone-500">Reload this page or close the tab and come back: the queue is restored from local storage.</p></div></section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Durable local queue</p><h2 className="mt-1 text-lg font-semibold text-stone-950">Pending batch events</h2></div><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">{queue.length} pending</span></div>{lastSync && <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950"><b>Last sync:</b> {lastSync.acceptedCount} accepted · {lastSync.duplicateCount} duplicate · {lastSync.rejectedCount} rejected · {lastSync.warningCount} warnings. Replaying the same batch is safe.</div>}<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Captured</th><th className="px-3 py-2">Local result</th><th className="px-3 py-2">Client event id</th></tr></thead><tbody className="divide-y divide-stone-100">{queue.length ? queue.map((item) => <tr key={item.clientEventId}><td className="px-3 py-3"><p className="font-semibold text-stone-900">{item.studentName}</p><p className="font-mono text-[10px] text-stone-400">{item.publicStudentId}{item.localWarning ? ` · ${item.localWarning}` : ""}</p></td><td className="px-3 py-3 text-stone-500">{prettyDate(item.deviceCapturedAt)}</td><td className="px-3 py-3">{item.lastResult ? <span className="text-rose-700">{item.lastResult}</span> : <span className="text-amber-700">pending</span>}</td><td className="px-3 py-3 font-mono text-[10px] text-stone-400">{item.clientEventId}</td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-stone-400">No pending events. The queue is intentionally empty after accepted or duplicate results are acknowledged.</td></tr>}</tbody></table></div></section>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-5"><section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Server reporting</p><h2 className="mt-1 text-xl font-semibold text-stone-950">Boarding events and exceptions</h2><p className="mt-2 text-xs leading-5 text-stone-500">Reports are sourced from immutable synced events. Wrong-bus scans remain counted as boardings and appear in the exception list.</p></div><button type="button" onClick={() => void refreshReport()} disabled={busy !== null || offline} className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"><RefreshCw className={cn("h-3.5 w-3.5", busy === "report" && "animate-spin")} /> Load report</button></div>{report ? <><div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-stone-50 p-4"><p className="text-[10px] uppercase tracking-wider text-stone-400">Total boardings</p><p className="mt-1 text-2xl font-semibold text-stone-950">{report.summary.totalBoardings}</p></div><div className="rounded-xl bg-stone-50 p-4"><p className="text-[10px] uppercase tracking-wider text-stone-400">Unique students</p><p className="mt-1 text-2xl font-semibold text-stone-950">{report.summary.uniqueStudents}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-[10px] uppercase tracking-wider text-amber-700">Exceptions</p><p className="mt-1 text-2xl font-semibold text-amber-950">{report.summary.wrongBusOrUnassigned}</p></div><div className="rounded-xl bg-stone-50 p-4"><p className="text-[10px] uppercase tracking-wider text-stone-400">Date window</p><p className="mt-1 text-xs font-semibold text-stone-900">{serviceDate}</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-stone-100 text-[10px] uppercase tracking-wider text-stone-400"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Bus / direction</th><th className="px-3 py-2">Captured</th><th className="px-3 py-2">Exception</th></tr></thead><tbody className="divide-y divide-stone-100">{report.exceptions.length ? report.exceptions.map((item) => <tr key={item.id}><td className="px-3 py-3"><p className="font-semibold text-stone-900">{item.student.studentName}</p><p className="font-mono text-[10px] text-stone-400">{item.student.studentId}</p></td><td className="px-3 py-3 text-stone-600">{item.bus.code} · {item.direction.replace("_", " ")}</td><td className="px-3 py-3 text-stone-500">{prettyDate(item.deviceCapturedAt)}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" /> {item.assignmentStatus === "UNASSIGNED" ? "Wrong bus / no assignment" : item.code}</span></td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-stone-400">No exceptions in this window.</td></tr>}</tbody></table></div></> : <div className="mt-6 rounded-xl border border-dashed border-stone-200 p-10 text-center"><FileWarning className="mx-auto h-8 w-8 text-stone-300" /><p className="mt-3 text-sm font-semibold text-stone-800">No report loaded</p><p className="mt-1 text-xs text-stone-500">Sync at least one batch, then load the server report.</p></div>}</section></div>
      )}

      {busy && <div className="fixed bottom-5 right-5 z-10 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-lg"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Working…</div>}
    </div>
  )
}
