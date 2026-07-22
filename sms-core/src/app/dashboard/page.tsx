"use client"

import { useEffect, useMemo, useState } from "react"
import { UniversalBarChart, type ChartDataPoint, type MetricConfig } from "@/components/universal-bar-chart"
import { UniversalAreaMiniChart } from "@/components/universal-area-mini-chart"
import { UniversalLineMiniChart } from "@/components/universal-line-mini-chart"
import { UniversalBarMiniChart } from "@/components/universal-bar-mini-chart"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

type DashboardSource = "live-counts" | "demo-fallback"

interface DashboardSnapshot {
  students: number
  teachers: number
  staff: number
  source: DashboardSource
}

interface DashboardSummary {
  studentEngagement: number
  facultySessions: number
  attendanceLogs: number
  supportOps: number
}

const DEFAULT_SNAPSHOT: DashboardSnapshot = {
  students: 842,
  teachers: 64,
  staff: 38,
  source: "demo-fallback",
}

const dashboardMetrics: MetricConfig[] = [
  { key: "studentEngagement", label: "Student Engagement", color: "#E85002" },
  { key: "attendanceLogs", label: "Attendance Logs", color: "#18181b" },
  { key: "facultySessions", label: "Teaching Sessions", color: "#71717a" },
  { key: "supportOps", label: "Support Operations", color: "#16a34a" },
]

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return null
}

function extractTotal(payload: unknown): number {
  const root = toRecord(payload)
  if (!root) return 0

  const directTotal = toNumber(root.total)
  if (directTotal !== null) return directTotal

  const pagination = toRecord(root.pagination)
  if (pagination) {
    const total = toNumber(pagination.total)
    if (total !== null) return total

    const totalItems = toNumber(pagination.totalItems)
    if (totalItems !== null) return totalItems
  }

  if (Array.isArray(root.data)) return root.data.length

  return 0
}

async function fetchEntityTotal(path: string): Promise<number> {
  const response = await fetchWithAuth(path)
  if (!response.ok) throw new Error(`Failed to load ${path}`)

  const payload = await response.json()
  return extractTotal(payload)
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildOperationalSeries(snapshot: DashboardSnapshot, days: number = 45): ChartDataPoint[] {
  const end = new Date()
  end.setHours(0, 0, 0, 0)

  // The charts are intentionally fictional operational simulations.
  // Live roster counts influence the simulation, but a minimum baseline
  // keeps the demo dashboard visually useful even in a small test database.
  const studentBase = Math.max(snapshot.students, DEFAULT_SNAPSHOT.students)
  const teacherBase = Math.max(snapshot.teachers, DEFAULT_SNAPSHOT.teachers)
  const staffBase = Math.max(snapshot.staff, DEFAULT_SNAPSHOT.staff)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - (days - index - 1))

    const weekday = date.getDay()
    const weekdayBoost = weekday === 0 || weekday === 6 ? 0.42 : 1
    const wave = Math.sin(index / 4) * 0.09
    const termPush = 1 + index / (days * 9)

    const studentEngagement = Math.round(studentBase * (0.58 + wave) * weekdayBoost * termPush)
    const attendanceLogs = Math.round(studentBase * (0.92 + Math.sin(index / 6) * 0.03) * weekdayBoost)
    const facultySessions = Math.round(teacherBase * (3.2 + Math.cos(index / 5) * 0.25) * weekdayBoost)
    const supportOps = Math.round(staffBase * (2.8 + Math.sin(index / 3) * 0.35) * weekdayBoost)

    return {
      date: toIsoDate(date),
      studentEngagement: Math.max(studentEngagement, 0),
      facultySessions: Math.max(facultySessions, 0),
      attendanceLogs: Math.max(attendanceLogs, 0),
      supportOps: Math.max(supportOps, 0),
    }
  })
}

function summarize(data: ChartDataPoint[]): DashboardSummary {
  return data.reduce<DashboardSummary>(
    (acc, point) => ({
      studentEngagement: acc.studentEngagement + (Number(point.studentEngagement) || 0),
      facultySessions: acc.facultySessions + (Number(point.facultySessions) || 0),
      attendanceLogs: acc.attendanceLogs + (Number(point.attendanceLogs) || 0),
      supportOps: acc.supportOps + (Number(point.supportOps) || 0),
    }),
    {
      studentEngagement: 0,
      facultySessions: 0,
      attendanceLogs: 0,
      supportOps: 0,
    },
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-2 md:p-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[112px] bg-white rounded-xl border border-zinc-200 p-4 shadow-sm animate-pulse" />
        ))}
      </div>
      <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm h-[430px] animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[220px] bg-white rounded-xl border border-zinc-200 p-4 shadow-sm animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string
  value: string
  helper: string
  tone?: "orange" | "green" | "neutral"
}) {
  const toneClass = {
    orange: "text-[#E85002]",
    green: "text-emerald-600",
    neutral: "text-zinc-900",
  }[tone]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-zinc-400">{helper}</p>
    </div>
  )
}

function SourceBadge({ snapshot }: { snapshot: DashboardSnapshot }) {
  const isLive = snapshot.source === "live-counts"

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {isLive ? "Live roster counts + fictional operations simulation" : "Fictional demo fallback"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Dashboard trends are simulated for admin testing. Roster cards use live counts when available.
        </p>
      </div>

      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${isLive ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-[#E85002]"}`}>
        {isLive ? "Live Counts" : "Demo Mode"}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(DEFAULT_SNAPSHOT)
  const [data, setData] = useState<ChartDataPoint[]>(() => buildOperationalSeries(DEFAULT_SNAPSHOT))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadMetrics() {
      try {
        const [studentsResult, teachersResult, staffResult] = await Promise.allSettled([
          fetchEntityTotal("/students?limit=1"),
          fetchEntityTotal("/teachers?limit=1"),
          fetchEntityTotal("/staff?limit=1"),
        ])

        if (cancelled) return

        const students = studentsResult.status === "fulfilled" ? studentsResult.value : 0
        const teachers = teachersResult.status === "fulfilled" ? teachersResult.value : 0
        const staff = staffResult.status === "fulfilled" ? staffResult.value : 0
        const hasAnyLiveCount = [studentsResult, teachersResult, staffResult].some((result) => result.status === "fulfilled")

        const nextSnapshot: DashboardSnapshot = hasAnyLiveCount
          ? {
              students,
              teachers,
              staff,
              source: "live-counts",
            }
          : DEFAULT_SNAPSHOT

        setSnapshot(nextSnapshot)
        setData(buildOperationalSeries(nextSnapshot))
      } catch {
        if (cancelled) return
        setSnapshot(DEFAULT_SNAPSHOT)
        setData(buildOperationalSeries(DEFAULT_SNAPSHOT))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadMetrics()

    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => summarize(data), [data])
  const averageAttendance = data.length > 0 ? Math.round(summary.attendanceLogs / data.length) : 0

  if (isLoading) return <DashboardSkeleton />

  return (
    <div className="flex flex-col gap-4 p-2 md:p-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Student Body"
          value={snapshot.students.toLocaleString()}
          helper="Current roster count from live API when available"
          tone="orange"
        />
        <KpiCard
          label="Teaching Faculty"
          value={snapshot.teachers.toLocaleString()}
          helper="Active instructional personnel"
        />
        <KpiCard
          label="Support Staff"
          value={snapshot.staff.toLocaleString()}
          helper="Administrative and operations workforce"
        />
        <KpiCard
          label="Avg Daily Attendance Logs"
          value={averageAttendance.toLocaleString()}
          helper="Fictional operational trend for admin testing"
          tone="green"
        />
      </div>

      <SourceBadge snapshot={snapshot} />

      <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
        <UniversalBarChart
          title="Institutional Command Center"
          description="Fictional operating trends for enrollment engagement, attendance throughput, teaching sessions, and support activity."
          data={data}
          metrics={dashboardMetrics}
          defaultMetricKey="studentEngagement"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <UniversalAreaMiniChart
          title="Engagement vs Faculty"
          subtitle="Student activity mapped against teaching sessions"
          data={data}
          dataKey="studentEngagement"
          secondaryDataKey="facultySessions"
          color="#E85002"
          secondaryColor="#18181b"
          height={135}
        />

        <UniversalLineMiniChart
          title="Attendance Throughput"
          subtitle="Fictional daily attendance entries"
          data={data}
          dataKey="attendanceLogs"
          color="#18181b"
          height={135}
        />

        <UniversalBarMiniChart
          title="Teaching Sessions"
          subtitle="Classroom periods and faculty activity"
          data={data}
          dataKey="facultySessions"
          color="#E85002"
          height={135}
        />

        <UniversalBarMiniChart
          title="Support Operations"
          subtitle="Registry, facilities, and service activity"
          data={data}
          dataKey="supportOps"
          color="#18181b"
          height={135}
        />
      </div>
    </div>
  )
}
