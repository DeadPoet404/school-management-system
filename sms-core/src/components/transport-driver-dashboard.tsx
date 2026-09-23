"use client"

import * as React from "react"
import { BusFront, CheckCircle2, ScanLine, Search, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getTransportBuses,
  getTransportRoster,
  getTransportTrips,
  getTransportReport,
  openTransportTrip,
  syncTransportBatch,
  type TransportBus,
  type TransportRoster,
  type TransportRosterEntry,
} from "@/lib/api/transport"

const STORAGE_KEY = "sms.transport.driver.mvp.v1"

type QueueItem = {
  clientEventId: string
  tripId: string
  qrToken: string
  studentId: string
  studentName: string
  deviceCapturedAt: string
  rosterVersion: string | null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TransportDriverDashboard() {
  const [buses, setBuses] = React.useState<TransportBus[]>([])
  const [selectedBusId, setSelectedBusId] = React.useState("")
  const [roster, setRoster] = React.useState<TransportRoster | null>(null)
  const [tripId, setTripId] = React.useState("")
  const [boardedIds, setBoardedIds] = React.useState<Set<string>>(new Set())
  const [queue, setQueue] = React.useState<QueueItem[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw).queue ?? [] : []
    } catch {
      return []
    }
  })
  const [scanValue, setScanValue] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [isOnline, setIsOnline] = React.useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? null
  const serviceDate = today()

  // online/offline detection
  React.useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  // persist queue
  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ queue }))
  }, [queue])

  // load buses + auto select
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const busData = await getTransportBuses()
        if (cancelled) return
        setBuses(busData)
        if (busData.length && !selectedBusId) {
          setSelectedBusId(busData[0].id)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // load trip + roster + boarded
  React.useEffect(() => {
    if (!selectedBusId) return
    let cancelled = false
    async function loadTripAndRoster() {
      setLoading(true)
      try {
        // 1. ensure trip exists for today TO_SCHOOL
        const trips = await getTransportTrips(serviceDate)
        let trip = trips.find((t) => t.busId === selectedBusId && t.serviceDate.slice(0, 10) === serviceDate && t.status === "OPEN")
        if (!trip) {
          try {
            trip = await openTransportTrip({ busId: selectedBusId, serviceDate, direction: "TO_SCHOOL" })
          } catch {
            // if 409, try reopen
            const existing = trips.find((t) => t.busId === selectedBusId && t.serviceDate.slice(0, 10) === serviceDate)
            if (existing) {
              try {
                trip = await openTransportTrip({ busId: selectedBusId, serviceDate, direction: "TO_SCHOOL", reopen: true })
              } catch {
                trip = existing
              }
            }
          }
        }
        if (cancelled) return
        if (trip) setTripId(trip.id)

        // 2. roster
        const rosterData = await getTransportRoster({ busId: selectedBusId, serviceDate, direction: "TO_SCHOOL" })
        if (cancelled) return
        setRoster(rosterData)

        // 3. boarded from server report
        const from = `${serviceDate}T00:00:00.000Z`
        const to = `${serviceDate}T23:59:59.999Z`
        const report = await getTransportReport({ from, to, busId: selectedBusId }).catch(() => null)
        if (cancelled) return
        if (report) {
          // report doesn't return boarded list directly, but we can infer from summary? 
          // Actually we need to fetch events - the report type in API only returns summary + exceptions.
          // For MVP, we will use boardedIds from local queue + try to get from trips _count? 
          // Workaround: we have boardedIds from previous syncs stored? Instead, fetch via syncBatch results?
          // Let's try to use the report events if available (backend returns events in full report, but typed as TransportReport without events - we will parse raw)
          // For simplicity, we will keep boardedIds as server-known via a separate fetch of boarding events via report API raw
          try {
            const rawRes = await fetch(`/api/transport/reports/boardings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&busId=${encodeURIComponent(selectedBusId)}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` },
            }).then((r) => r.json())
            const events = rawRes?.data?.events ?? rawRes?.events ?? []
            const ids = new Set<string>(events.map((e: any) => e.studentId))
            setBoardedIds(ids)
          } catch {
            // fallback keep existing
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTripAndRoster()
    return () => {
      cancelled = true
    }
  }, [selectedBusId, serviceDate])

  // auto sync queue when online
  const syncQueue = React.useCallback(async () => {
    if (!tripId || queue.length === 0 || !isOnline) return
    const batchId = makeId()
    const deviceCode = `driver-${selectedBus?.code ?? "tablet"}-${serviceDate}`
    try {
      const res = await syncTransportBatch({
        batchId,
        deviceCode,
        tripId,
        events: queue.map((q) => ({
          clientEventId: q.clientEventId,
          qrToken: q.qrToken,
          studentId: q.studentId,
          source: "QR" as const,
          deviceCapturedAt: q.deviceCapturedAt,
          rosterVersion: q.rosterVersion,
        })),
      })
      const accepted = new Set(res.results.filter((r) => r.status === "ACCEPTED" || r.status === "DUPLICATE").map((r) => r.clientEventId))
      setQueue((prev) => prev.filter((q) => !accepted.has(q.clientEventId)))
      // merge boarded
      const newlyBoarded = res.results.filter((r) => r.status === "ACCEPTED" && r.studentId).map((r) => r.studentId!)
      if (newlyBoarded.length) {
        setBoardedIds((prev) => {
          const next = new Set(prev)
          newlyBoarded.forEach((id) => next.add(id))
          return next
        })
      }
    } catch {
      // keep queue for retry
    }
  }, [queue, tripId, isOnline, selectedBus, serviceDate])

  React.useEffect(() => {
    if (!isOnline) return
    const id = setInterval(() => {
      if (queue.length) void syncQueue()
    }, 4000)
    return () => clearInterval(id)
  }, [isOnline, queue.length, syncQueue])

  React.useEffect(() => {
    if (isOnline && queue.length) void syncQueue()
  }, [isOnline])

  const handleScan = (token: string) => {
    const value = token.trim()
    if (!value) return
    if (!roster) {
      setFeedback("Roster not loaded yet")
      return
    }
    if (!tripId) {
      setFeedback("Trip not ready")
      return
    }
    const entry = roster.roster.find((e) => e.card?.qrToken === value)
    if (!entry) {
      setFeedback("QR not on this bus roster")
      setTimeout(() => setFeedback(null), 2500)
      return
    }
    if (boardedIds.has(entry.student.id)) {
      setFeedback(`${entry.student.studentName} already boarded`)
      setTimeout(() => setFeedback(null), 2000)
      setScanValue("")
      return
    }
    // local board
    const item: QueueItem = {
      clientEventId: makeId(),
      tripId,
      qrToken: value,
      studentId: entry.student.id,
      studentName: entry.student.studentName,
      deviceCapturedAt: new Date().toISOString(),
      rosterVersion: roster.rosterVersion,
    }
    setQueue((prev) => [item, ...prev])
    setBoardedIds((prev) => new Set(prev).add(entry.student.id))
    setScanValue("")
    setFeedback(`✓ ${entry.student.studentName} boarded`)
    setTimeout(() => setFeedback(null), 2000)
    // try sync immediately
    if (isOnline) {
      setTimeout(() => void syncQueue(), 300)
    }
  }

  const handleManualBoard = (entry: TransportRosterEntry) => {
    if (boardedIds.has(entry.student.id)) return
    if (!tripId || !roster) return
    // For manual, we still need a token if available, else studentId
    const item: QueueItem = {
      clientEventId: makeId(),
      tripId,
      qrToken: entry.card?.qrToken ?? "",
      studentId: entry.student.id,
      studentName: entry.student.studentName,
      deviceCapturedAt: new Date().toISOString(),
      rosterVersion: roster.rosterVersion,
    }
    setQueue((prev) => [item, ...prev])
    setBoardedIds((prev) => new Set(prev).add(entry.student.id))
    setFeedback(`✓ ${entry.student.studentName} boarded (manual)`)
    setTimeout(() => setFeedback(null), 2000)
    if (isOnline) setTimeout(() => void syncQueue(), 300)
  }

  const filteredRoster = React.useMemo(() => {
    if (!roster) return []
    const term = search.trim().toLowerCase()
    if (!term) return roster.roster
    return roster.roster.filter((e) => e.student.studentName.toLowerCase().includes(term) || e.student.studentId.toLowerCase().includes(term))
  }, [roster, search])

  const notBoarded = filteredRoster.filter((e) => !boardedIds.has(e.student.id))
  const boarded = filteredRoster.filter((e) => boardedIds.has(e.student.id))

  if (loading && !roster) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <BusFront className="mx-auto h-8 w-8 animate-pulse text-stone-400" />
          <p className="mt-3 text-sm text-stone-600">Loading your bus...</p>
        </div>
      </div>
    )
  }

  if (!buses.length) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="font-semibold text-amber-900">No bus assigned</p>
          <p className="mt-1 text-sm text-amber-800">Ask admin to assign a bus to your driver account.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-20">
      {/* Header - tablet friendly */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-950 text-white">
              <BusFront className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Driver</p>
              <p className="text-lg font-bold leading-none text-stone-950">{selectedBus?.code ?? "Bus"}</p>
              <p className="text-xs text-stone-500">{serviceDate} · {roster?.roster.length ?? 0} students</p>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {isOnline ? <div className="h-2 w-2 rounded-full bg-emerald-500" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? "Online" : "Offline"}
            </div>
            {queue.length > 0 && <p className="mt-1 text-[11px] text-stone-500">{queue.length} syncing…</p>}
          </div>
        </div>

        {/* Bus selector if multiple */}
        {buses.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {buses.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBusId(b.id)}
                className={cn("whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold", selectedBusId === b.id ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-600")}
              >
                {b.code}
              </button>
            ))}
          </div>
        )}

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-700">{boarded.length} / {roster?.roster.length ?? 0} boarded</span>
            <span className="text-stone-400">{notBoarded.length} remaining</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${roster?.roster.length ? (boarded.length / roster.roster.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Scan box - big */}
      <div className="px-4">
        <div className="rounded-2xl border-2 border-stone-950 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-stone-500" />
            <p className="text-sm font-semibold text-stone-900">Scan QR to board</p>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleScan(scanValue)
              }}
              placeholder="Tap here and scan card..."
              className="h-14 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 text-lg font-mono outline-none focus:border-stone-950 focus:bg-white"
              autoFocus
            />
            <button onClick={() => handleScan(scanValue)} className="h-14 rounded-xl bg-stone-950 px-6 text-sm font-bold text-white">
              Board
            </button>
          </div>
          {feedback && <p className="mt-2 text-center text-sm font-semibold text-emerald-700">{feedback}</p>}
        </div>
      </div>

      {/* Search */}
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student..." className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-stone-400" />
        </div>
      </div>

      {/* Not boarded */}
      <div className="px-4">
        <h2 className="text-sm font-bold text-stone-900">Not boarded ({notBoarded.length})</h2>
        <div className="mt-2 space-y-2">
          {notBoarded.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500">All students boarded ✓</div>
          ) : (
            notBoarded.map((entry) => (
              <button key={entry.student.id} onClick={() => handleManualBoard(entry)} className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white p-4 text-left active:bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-700">{entry.student.studentName.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <p className="text-[15px] font-semibold leading-tight text-stone-950">{entry.student.studentName}</p>
                    <p className="text-xs text-stone-500">{entry.student.className ?? "No class"} · {entry.student.studentId}</p>
                    {entry.stop && <p className="text-[11px] text-stone-400">{entry.stop.name}</p>}
                  </div>
                </div>
                <div className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-600">Tap to board</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Boarded */}
      {boarded.length > 0 && (
        <div className="px-4">
          <h2 className="text-sm font-bold text-emerald-900">Boarded ({boarded.length})</h2>
          <div className="mt-2 space-y-2">
            {boarded.map((entry) => (
              <div key={entry.student.id} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold leading-tight text-emerald-950">{entry.student.studentName}</p>
                    <p className="text-xs text-emerald-700">{entry.student.className ?? ""} · boarded</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
