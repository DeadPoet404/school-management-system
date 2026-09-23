"use client"

import * as React from "react"
import { BusFront, CheckCircle2, Plus, QrCode, Search, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  assignTransportBusDriver,
  assignTransportStudent,
  createTransportBus,
  getTransportBuses,
  getTransportDrivers,
  getTransportRoster,
  getTransportStudents,
  issueTransportCard,
  openTransportTrip,
  getTransportTrips,
  type TransportBus,
  type TransportDriver,
  type TransportRoster,
  type TransportStudent,
} from "@/lib/api/transport"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransportDashboard() {
  const [buses, setBuses] = React.useState<TransportBus[]>([])
  const [drivers, setDrivers] = React.useState<TransportDriver[]>([])
  const [students, setStudents] = React.useState<TransportStudent[]>([])
  const [selectedBusId, setSelectedBusId] = React.useState("")
  const [serviceDate, setServiceDate] = React.useState(today())
  const [roster, setRoster] = React.useState<TransportRoster | null>(null)
  const [boardedMap, setBoardedMap] = React.useState<Map<string, string>>(new Map()) // studentId -> time
  const [search, setSearch] = React.useState("")
  const [studentSearch, setStudentSearch] = React.useState("")
  const [selectedStudentId, setSelectedStudentId] = React.useState("")
  const [newBusCode, setNewBusCode] = React.useState("")
  const [assignDriverBusId, setAssignDriverBusId] = React.useState("")
  const [assignDriverId, setAssignDriverId] = React.useState("")
  const [busy, setBusy] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)

  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? null
  const assignBus = buses.find((b) => b.id === assignDriverBusId) ?? null

  const loadAll = React.useCallback(async () => {
    try {
      const [busData, driverData, studentData] = await Promise.all([
        getTransportBuses(),
        getTransportDrivers().catch(() => [] as TransportDriver[]),
        getTransportStudents(studentSearch || undefined),
      ])
      setBuses(busData)
      setDrivers(driverData)
      setStudents(studentData)
      if (!selectedBusId && busData[0]) setSelectedBusId(busData[0].id)
      if (!assignDriverBusId && busData[0]) setAssignDriverBusId(busData[0].id)
    } catch (e) {
      console.error(e)
    }
  }, [selectedBusId, assignDriverBusId, studentSearch])

  React.useEffect(() => {
    void loadAll()
  }, [loadAll])

  const loadRosterAndBoarded = React.useCallback(async () => {
    if (!selectedBusId) return
    setBusy("roster")
    try {
      // ensure trip open
      const trips = await getTransportTrips(serviceDate).catch(() => [])
      let trip = trips.find((t) => t.busId === selectedBusId && t.serviceDate.slice(0, 10) === serviceDate)
      if (!trip) {
        try {
          await openTransportTrip({ busId: selectedBusId, serviceDate, direction: "TO_SCHOOL" })
        } catch {}
      }

      const rosterData = await getTransportRoster({ busId: selectedBusId, serviceDate, direction: "TO_SCHOOL" })
      setRoster(rosterData)

      // fetch boarded via report raw
      try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : ""
        const from = `${serviceDate}T00:00:00.000Z`
        const to = `${serviceDate}T23:59:59.999Z`
        const res = await fetch(`/api/transport/reports/boardings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&busId=${encodeURIComponent(selectedBusId)}`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        }).then((r) => r.json())
        const events = res?.data?.events ?? res?.events ?? []
        const map = new Map<string, string>()
        for (const ev of events) {
          if (!map.has(ev.studentId)) map.set(ev.studentId, ev.deviceCapturedAt)
        }
        setBoardedMap(map)
      } catch {
        setBoardedMap(new Map())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(null)
    }
  }, [selectedBusId, serviceDate])

  React.useEffect(() => {
    if (selectedBusId) void loadRosterAndBoarded()
  }, [selectedBusId, serviceDate, loadRosterAndBoarded])

  const createBus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBusCode.trim()) return
    setBusy("bus")
    try {
      const bus = await createTransportBus({ code: newBusCode.trim() })
      setBuses((prev) => [...prev, bus].sort((a, b) => a.code.localeCompare(b.code)))
      setSelectedBusId(bus.id)
      setNewBusCode("")
      setFeedback(`Bus ${bus.code} created`)
      setTimeout(() => setFeedback(null), 2500)
    } catch (err: any) {
      setFeedback(err?.message ?? "Failed to create bus")
    } finally {
      setBusy(null)
    }
  }

  const assignDriver = async () => {
    if (!assignDriverBusId) return
    setBusy("driver")
    try {
      const updated = await assignTransportBusDriver(assignDriverBusId, assignDriverId || null)
      setBuses((prev) => prev.map((b) => (b.id === updated.id ? { ...b, driver: updated.driver, driverStaffId: updated.driverStaffId } : b)))
      setFeedback(assignDriverId ? `Driver assigned to ${updated.code}` : `Driver removed from ${updated.code}`)
      setTimeout(() => setFeedback(null), 2500)
    } catch (err: any) {
      setFeedback(err?.message ?? "Assign failed")
    } finally {
      setBusy(null)
    }
  }

  const assignStudent = async () => {
    if (!selectedStudentId || !selectedBusId) return
    setBusy("assign")
    try {
      await assignTransportStudent({ studentId: selectedStudentId, busId: selectedBusId, effectiveFrom: `${serviceDate}T00:00:00.000Z` })
      setFeedback("Student assigned to bus")
      setTimeout(() => setFeedback(null), 2500)
      await loadRosterAndBoarded()
    } catch (err: any) {
      setFeedback(err?.message ?? "Assign failed")
    } finally {
      setBusy(null)
    }
  }

  const issueCard = async () => {
    if (!selectedStudentId) return
    setBusy("card")
    try {
      await issueTransportCard({ studentId: selectedStudentId, replaceExisting: true })
      setFeedback("QR card issued")
      setTimeout(() => setFeedback(null), 2500)
      const studentData = await getTransportStudents(studentSearch || undefined)
      setStudents(studentData)
      await loadRosterAndBoarded()
    } catch (err: any) {
      setFeedback(err?.message ?? "Card issue failed")
    } finally {
      setBusy(null)
    }
  }

  const boarded = roster?.roster.filter((e) => boardedMap.has(e.student.id)) ?? []
  const notBoarded = roster?.roster.filter((e) => !boardedMap.has(e.student.id)) ?? []
  const filteredNotBoarded = notBoarded.filter((e) => {
    const term = search.toLowerCase()
    if (!term) return true
    return e.student.studentName.toLowerCase().includes(term) || e.student.studentId.toLowerCase().includes(term)
  })
  const filteredBoarded = boarded.filter((e) => {
    const term = search.toLowerCase()
    if (!term) return true
    return e.student.studentName.toLowerCase().includes(term) || e.student.studentId.toLowerCase().includes(term)
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="border-b border-stone-200 pb-4 pt-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
          <BusFront className="h-3.5 w-3.5" /> Transport
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-950">Bus boarding — simple MVP</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">Driver scans before entry on tablet. Admin sees who boarded vs who didn&apos;t. No routes, no complex tabs.</p>
        {feedback && <div className="mt-3 rounded-lg bg-stone-950 px-3 py-2 text-sm text-white">{feedback}</div>}
      </header>

      {/* Buses + driver */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-bold text-stone-900">Buses</h2>
          <form onSubmit={createBus} className="mt-3 flex gap-2">
            <input value={newBusCode} onChange={(e) => setNewBusCode(e.target.value)} placeholder="Bus code e.g. BUS-01" className="h-10 flex-1 rounded-lg border border-stone-200 px-3 text-sm outline-none focus:border-stone-900" />
            <button type="submit" disabled={busy === "bus"} className="inline-flex h-10 items-center gap-1 rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white disabled:opacity-40">
              <Plus className="h-4 w-4" /> Add
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {buses.map((bus) => (
              <div key={bus.id} className={cn("flex items-center justify-between rounded-xl border p-3", selectedBusId === bus.id ? "border-stone-900 bg-stone-50" : "border-stone-200")}>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{bus.code}</p>
                  <p className="text-xs text-stone-500">{bus.driver ? bus.driver.staffName : "No driver"} · {bus._count?.assignments ?? 0} students</p>
                </div>
                <button onClick={() => setSelectedBusId(bus.id)} className="rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-semibold">View</button>
              </div>
            ))}
            {buses.length === 0 && <p className="text-sm text-stone-400">No buses yet. Create one.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-bold text-stone-900">Assign driver to bus</h2>
          <p className="mt-1 text-xs text-stone-500">Driver logs in on tablet and sees only his bus.</p>
          <div className="mt-3 space-y-3">
            <select value={assignDriverBusId} onChange={(e) => setAssignDriverBusId(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 px-3 text-sm">
              <option value="">Select bus</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>{b.code}</option>
              ))}
            </select>
            <select value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 px-3 text-sm">
              <option value="">— No driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.staffName} · {d.account?.email ?? d.staffId}</option>
              ))}
            </select>
            <button onClick={() => void assignDriver()} disabled={busy === "driver" || !assignDriverBusId} className="h-10 w-full rounded-lg bg-stone-950 text-sm font-semibold text-white disabled:opacity-40">
              {assignDriverId ? "Assign driver" : "Remove driver"}
            </button>
            {assignBus?.driver && <p className="text-xs text-stone-600">Current: {assignBus.driver.staffName}</p>}
          </div>
        </div>
      </section>

      {/* Assign students */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-bold text-stone-900">Assign students to bus</h2>
        <p className="mt-1 text-xs text-stone-500">Search active student, assign to selected bus, issue QR card.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={selectedBusId} onChange={(e) => setSelectedBusId(e.target.value)} className="h-10 rounded-lg border border-stone-200 px-3 text-sm">
            <option value="">Select bus</option>
            {buses.map((b) => (
              <option key={b.id} value={b.id}>{b.code}</option>
            ))}
          </select>
          <div className="flex flex-1 gap-2">
            <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 text-sm">
              <option value="">Choose student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentName} · {s.studentId}</option>
              ))}
            </select>
            <button onClick={() => void assignStudent()} disabled={!selectedStudentId || !selectedBusId || busy === "assign"} className="h-10 rounded-lg border border-stone-200 bg-white px-4 text-sm font-semibold disabled:opacity-40">Assign</button>
            <button onClick={() => void issueCard()} disabled={!selectedStudentId || busy === "card"} className="inline-flex h-10 items-center gap-1 rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white disabled:opacity-40"><QrCode className="h-4 w-4" /> QR</button>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search students..." className="h-9 flex-1 rounded-lg border border-stone-200 px-3 text-sm" />
          <button onClick={() => void loadAll()} className="h-9 rounded-lg border border-stone-200 px-3 text-sm">Search</button>
        </div>
      </section>

      {/* Today's boarding */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Today&apos;s boarding</h2>
            <p className="text-xs text-stone-500">Admin sees who boarded and who didn&apos;t.</p>
          </div>
          <div className="flex gap-2">
            <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="h-9 rounded-lg border border-stone-200 px-3 text-sm" />
            <select value={selectedBusId} onChange={(e) => setSelectedBusId(e.target.value)} className="h-9 rounded-lg border border-stone-200 px-3 text-sm">
              {buses.map((b) => (
                <option key={b.id} value={b.id}>{b.code}</option>
              ))}
            </select>
          </div>
        </div>

        {roster ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] uppercase tracking-wider text-stone-400">Assigned</p><p className="mt-1 text-xl font-bold">{roster.roster.length}</p></div>
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[11px] uppercase tracking-wider text-emerald-700">Boarded</p><p className="mt-1 text-xl font-bold text-emerald-900">{boarded.length}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-[11px] uppercase tracking-wider text-amber-700">Remaining</p><p className="mt-1 text-xl font-bold text-amber-900">{notBoarded.length}</p></div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search boarded / not boarded..." className="h-10 w-full rounded-lg border border-stone-200 bg-white pl-10 pr-3 text-sm" />
              </div>
              <button onClick={() => void loadRosterAndBoarded()} disabled={busy === "roster"} className="h-10 rounded-lg border border-stone-200 px-4 text-sm">Refresh</button>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900"><Users className="h-4 w-4" /> Not boarded ({filteredNotBoarded.length})</h3>
                <div className="mt-3 space-y-2">
                  {filteredNotBoarded.map((entry) => (
                    <div key={entry.student.id} className="flex items-center justify-between rounded-xl border border-stone-200 p-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{entry.student.studentName}</p>
                        <p className="text-xs text-stone-500">{entry.student.className ?? "No class"} · {entry.student.studentId}</p>
                      </div>
                      <span className="text-xs text-stone-400">{entry.card ? "QR ready" : "No QR"}</span>
                    </div>
                  ))}
                  {filteredNotBoarded.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-stone-400">All boarded or no match</p>}
                </div>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> Boarded ({filteredBoarded.length})</h3>
                <div className="mt-3 space-y-2">
                  {filteredBoarded.map((entry) => (
                    <div key={entry.student.id} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-950">{entry.student.studentName}</p>
                        <p className="text-xs text-emerald-700">{entry.student.className ?? ""} · {entry.student.studentId}</p>
                      </div>
                      <span className="text-xs text-emerald-700">{boardedMap.get(entry.student.id)?.slice(11, 16) ?? "boarded"}</span>
                    </div>
                  ))}
                  {filteredBoarded.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-stone-400">No boardings yet today</p>}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-stone-500">Select a bus to see today&apos;s boarding</div>
        )}
      </section>
    </div>
  )
}
