"use client"

import * as React from "react"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
} from "lucide-react"
import { toast } from "sonner"

import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { useAuth } from "@/lib/auth-context"
import { useClasses } from "@/lib/api/reference"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Channel = "SMS" | "WHATSAPP" | "EMAIL"
type Audience = "SCHOOL_WIDE" | "CLASS" | "STUDENTS"
type Tab = "compose" | "log"

interface AnnouncementRow {
  id: string
  title: string
  audience: string
  channels: unknown
  status: string
  createdByEmail: string
  createdAt: string
  deliveryCounts: { queued: number; sent: number; failed: number; total: number }
}

interface DeliveryRow {
  id: string
  channel: string
  recipient: string
  recipientLabel: string | null
  status: string
  attempts: number
  providerMessageId: string | null
  error: string | null
  sentAt: string | null
}

interface StudentOption {
  id: string
  studentId: string
  studentName: string
}

const CHANNEL_OPTIONS: { id: Channel; label: string; hint: string }[] = [
  { id: "SMS", label: "SMS", hint: "Arkesel, guardian phones" },
  { id: "WHATSAPP", label: "WhatsApp", hint: "Meta Cloud API (dark until verified)" },
  { id: "EMAIL", label: "Email", hint: "guardian emails + portal email" },
]

const chipBase = "rounded-full px-2 py-0.5 text-[10px] font-semibold"

function StatusChip({ status, count }: { status: string; count: number }) {
  const tone =
    status === "SENT"
      ? "bg-emerald-100 text-emerald-700"
      : status === "FAILED"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700"
  return (
    <span className={cn(chipBase, tone)}>
      {status.toLowerCase()} {count}
    </span>
  )
}

function channelsLabel(raw: unknown): string {
  return Array.isArray(raw) ? raw.map(String).join(" + ") : "—"
}

export function CommunicationCenter() {
  const { user } = useAuth()
  const canCompose = user?.role === "ADMIN"
  const { data: classes = [] } = useClasses()

  const [tab, setTab] = React.useState<Tab>("log")

  /* ── compose state ── */
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [audience, setAudience] = React.useState<Audience>("SCHOOL_WIDE")
  const [classId, setClassId] = React.useState("")
  const [studentQuery, setStudentQuery] = React.useState("")
  const [students, setStudents] = React.useState<StudentOption[]>([])
  const [studentsLoaded, setStudentsLoaded] = React.useState(false)
  const [selectedStudents, setSelectedStudents] = React.useState<Set<string>>(new Set())
  const [channels, setChannels] = React.useState<Set<Channel>>(new Set(["SMS"]))
  const [sending, setSending] = React.useState(false)

  /* ── delivery log state ── */
  const [rows, setRows] = React.useState<AnnouncementRow[]>([])
  const [logLoading, setLogLoading] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [deliveries, setDeliveries] = React.useState<Record<string, DeliveryRow[]>>({})
  const [deliveryLoading, setDeliveryLoading] = React.useState<string | null>(null)

  const loadLog = React.useCallback(async () => {
    try {
      setLogLoading(true)
      const response = await fetchWithAuth("/communication/announcements")
      const payload = await response.json()
      if (response.ok && payload?.success && Array.isArray(payload.data)) {
        setRows(payload.data as AnnouncementRow[])
      }
    } catch {
      toast.error("Unable to load announcements.")
    } finally {
      setLogLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadLog()
  }, [loadLog])

  // Default admins to the compose tab once the role is known.
  const tabInitialized = React.useRef(false)
  React.useEffect(() => {
    if (!tabInitialized.current && canCompose) {
      tabInitialized.current = true
      setTab("compose")
    }
  }, [canCompose])

  // Lazy-load the student directory only when the per-student audience is picked.
  React.useEffect(() => {
    if (audience !== "STUDENTS" || studentsLoaded) return
    void (async () => {
      try {
        const response = await fetchWithAuth("/students")
        const payload = await response.json()
        const list = Array.isArray(payload?.data) ? (payload.data as StudentOption[]) : []
        setStudents(list)
        setStudentsLoaded(true)
      } catch {
        toast.error("Unable to load students for the picker.")
      }
    })()
  }, [audience, studentsLoaded])

  const toggleChannel = (channel: Channel) => {
    setChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) next.delete(channel)
      else next.add(channel)
      return next
    })
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleStudents = React.useMemo(() => {
    const q = studentQuery.trim().toLowerCase()
    if (!q) return students.slice(0, 30)
    return students
      .filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q)
      )
      .slice(0, 30)
  }, [students, studentQuery])

  const handleCompose = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required.")
      return
    }
    if (audience === "CLASS" && !classId) {
      toast.error("Pick a class for CLASS announcements.")
      return
    }
    if (audience === "STUDENTS" && selectedStudents.size === 0) {
      toast.error("Pick at least one student.")
      return
    }
    if (channels.size === 0) {
      toast.error("Pick at least one channel.")
      return
    }

    try {
      setSending(true)
      const response = await fetchWithAuth("/communication/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          ...(audience === "CLASS" ? { classId } : {}),
          ...(audience === "STUDENTS" ? { studentIds: [...selectedStudents] } : {}),
          channels: [...channels],
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? "Unable to send announcement.")
      }
      const counts = Object.entries(payload.data.channelCounts ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join("  ")
      toast.success(`Queued for ${payload.data.recipientCount} recipient(s) — ${counts}`)
      setTitle("")
      setBody("")
      setSelectedStudents(new Set())
      setExpandedId(null)
      await loadLog()
      setTab("log")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send announcement.")
    } finally {
      setSending(false)
    }
  }

  const toggleExpanded = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (deliveries[id]) return
    try {
      setDeliveryLoading(id)
      const response = await fetchWithAuth(`/communication/announcements/${id}/deliveries`)
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? "Unable to load deliveries.")
      }
      setDeliveries((prev) => ({ ...prev, [id]: payload.data.deliveries as DeliveryRow[] }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load deliveries.")
    } finally {
      setDeliveryLoading(null)
    }
  }

  return (
    <main className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden bg-transparent px-8 py-6">
      <div className="shrink-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-stone-900">
          <Megaphone className="h-5 w-5 text-stone-500" />
          Communication
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Announcements and notices over SMS, WhatsApp and email, with a durable
          per-recipient delivery ledger.
        </p>
      </div>

      <div className="mt-4 flex shrink-0 items-center gap-2">
        {canCompose && (
          <button
            type="button"
            onClick={() => setTab("compose")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              tab === "compose"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            )}
          >
            Compose
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab("log")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            tab === "log"
              ? "bg-stone-900 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          )}
        >
          Delivery Log
        </button>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-3">
        {tab === "compose" && canCompose && (
          <form onSubmit={handleCompose} className="mx-auto max-w-3xl space-y-6 pb-12">
            <section className="space-y-4 rounded-lg border border-stone-200/70 bg-stone-50/60 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="announce-title">Title</Label>
                <Input
                  id="announce-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Reopening — Term 1"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="announce-body">Message</Label>
                <textarea
                  id="announce-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="School reopens Monday 07:30 prompt."
                  rows={4}
                  maxLength={4000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-stone-400">{body.length}/4000 — SMS providers segment long messages.</p>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-stone-200/70 bg-stone-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Audience</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["SCHOOL_WIDE", "School-wide (all ACTIVE students)"],
                    ["CLASS", "Per class"],
                    ["STUDENTS", "Specific students"],
                  ] as [Audience, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAudience(value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      audience === value
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {audience === "CLASS" && (
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="">Select class</option>
                  {classes
                    .filter((c) => c.isActive !== false)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              )}

              {audience === "STUDENTS" && (
                <div className="space-y-2">
                  <Input
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Search students by name or id"
                    className="h-8 text-xs"
                  />
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-stone-200 bg-white p-2">
                    {visibleStudents.length === 0 && (
                      <p className="py-2 text-center text-[11px] text-stone-400">
                        {studentsLoaded ? "No matches." : "Loading students..."}
                      </p>
                    )}
                    {visibleStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-stone-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => toggleStudent(student.id)}
                        />
                        <span className="font-medium text-stone-700">{student.studentName}</span>
                        <span className="text-stone-400">{student.studentId}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {selectedStudents.size} selected
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-stone-200/70 bg-stone-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Channels</p>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleChannel(option.id)}
                    title={option.hint}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      channels.has(option.id)
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-snug text-stone-400">
                Unconfigured channels stay disabled server-side: their deliveries are
                recorded as channel-disabled in the ledger instead of vanishing.
              </p>
            </section>

            <div className="flex justify-end border-t pt-4">
              <Button type="submit" disabled={sending} className="min-w-[200px]">
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Queueing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Announcement
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {tab === "log" && (
          <div className="mx-auto max-w-4xl space-y-3 pb-12">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-400">
                The dispatch worker sweeps every 60s; refresh to see updated statuses.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadLog()} disabled={logLoading}>
                {logLoading ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
            </div>

            {rows.length === 0 && !logLoading && (
              <div className="rounded-lg border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
                No announcements yet.
              </div>
            )}

            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-stone-200/70 bg-white">
                <button
                  type="button"
                  onClick={() => void toggleExpanded(row.id)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  {expandedId === row.id ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900">{row.title}</span>
                      <span className={cn(chipBase, "bg-stone-100 text-stone-600")}>{row.status}</span>
                      <StatusChip status="QUEUED" count={row.deliveryCounts.queued} />
                      <StatusChip status="SENT" count={row.deliveryCounts.sent} />
                      <StatusChip status="FAILED" count={row.deliveryCounts.failed} />
                    </div>
                    <p className="mt-1 text-[11px] text-stone-400">
                      {row.audience} · {channelsLabel(row.channels)} · {row.deliveryCounts.total} deliveries ·{" "}
                      {new Date(row.createdAt).toLocaleString()} · by {row.createdByEmail}
                    </p>
                  </div>
                </button>

                {expandedId === row.id && (
                  <div className="border-t border-stone-100 p-3">
                    {deliveryLoading === row.id ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-stone-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading ledger...
                      </div>
                    ) : (deliveries[row.id] ?? []).length === 0 ? (
                      <p className="py-2 text-xs text-stone-400">No deliveries recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="text-stone-400">
                              <th className="pb-1 pr-3 font-semibold">Channel</th>
                              <th className="pb-1 pr-3 font-semibold">Recipient</th>
                              <th className="pb-1 pr-3 font-semibold">Status</th>
                              <th className="pb-1 pr-3 font-semibold">Tries</th>
                              <th className="pb-1 font-semibold">Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(deliveries[row.id] ?? []).map((d) => (
                              <tr key={d.id} className="border-t border-stone-100 text-stone-600">
                                <td className="py-1 pr-3 font-medium">{d.channel}</td>
                                <td className="py-1 pr-3">
                                  {d.recipient}
                                  {d.recipientLabel ? (
                                    <span className="text-stone-400"> ({d.recipientLabel})</span>
                                  ) : null}
                                </td>
                                <td className="py-1 pr-3">
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      d.status === "SENT"
                                        ? "text-emerald-600"
                                        : d.status === "FAILED"
                                          ? "text-red-600"
                                          : "text-amber-600"
                                    )}
                                  >
                                    {d.status}
                                  </span>
                                </td>
                                <td className="py-1 pr-3">{d.attempts}</td>
                                <td className="py-1 text-stone-400">
                                  {d.error ??
                                    (d.providerMessageId ? `id ${d.providerMessageId}` : "—")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
