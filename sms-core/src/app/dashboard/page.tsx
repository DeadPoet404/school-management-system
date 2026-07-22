"use client"
import React, { useEffect, useState } from 'react'
import { UniversalBarChart, ChartDataPoint, MetricConfig } from '@/components/universal-bar-chart'
import { UniversalAreaMiniChart } from '@/components/universal-area-mini-chart'
import { UniversalLineMiniChart } from '@/components/universal-line-mini-chart'
import { UniversalBarMiniChart } from '@/components/universal-bar-mini-chart'
import { fetchWithAuth } from '@/lib/fetch-with-auth'

// ── Helpers ───────────────────────────────────────────────────────────
// The backend list endpoints wrap totals either as `total` or as
// `pagination.total`; defensively accept either and treat non-ok
// responses as zero so the dashboard never crashes the page.
async function fetchTotal(path: string): Promise<number> {
  try {
    const res = await fetchWithAuth(path)
    if (!res.ok) return 0
    const json = await res.json()
    // Backend pagination envelope uses pagination.totalItems; some older
    // controllers return a top-level `total`. Accept any of them.
    const n = Number(
      json?.pagination?.totalItems ??
      json?.pagination?.total ??
      json?.total ??
      0,
    )
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

// The Universal*Chart components compute their headline numbers by
// SUMMING `dataKey` across all rows, and the main bar chart draws one
// bar per row. So to produce three distinct, non-double-counted metrics
// we emit one row per category and populate the target metric column
// only, leaving the other columns zero. The reduce then returns the
// correct per-metric total, and the bars align 1:1 with categories.
function buildChartData(
  studentTotal: number,
  teacherTotal: number,
  staffTotal: number,
): ChartDataPoint[] {
  return [
    // Row label is used as the x-axis category.
    { date: "Students",     population: studentTotal, personnel: 0,            support: 0            },
    { date: "Teachers",     population: 0,            personnel: teacherTotal, support: 0            },
    { date: "Support Staff", population: 0,           personnel: 0,            support: staffTotal   },
  ]
}

export default function DashboardPage() {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadMetrics() {
      try {
        setIsLoading(true)
        setError(null)

        const [studentTotal, teacherTotal, staffTotal] = await Promise.all([
          fetchTotal("/students?limit=1"),
          fetchTotal("/teachers?limit=1"),
          fetchTotal("/staff?limit=1"),
        ])

        if (cancelled) return
        setData(buildChartData(studentTotal, teacherTotal, staffTotal))
      } catch {
        if (!cancelled) setError("Unable to load dashboard metrics.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadMetrics()
    return () => { cancelled = true }
  }, [])

  // Three tabs so users can flip between population / teaching staff /
  // support staff in the main bar chart; the headline numbers above the
  // chart are computed per-metric by reducing the data.
  const metrics: MetricConfig[] = [
    { key: "population", label: "Student Population", color: "#E85002" },
    { key: "personnel",  label: "Teaching Staff",    color: "#18181b" },
    { key: "support",    label: "Support Staff",     color: "#52525b" },
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-2 md:p-1">
        <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm h-[320px] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[155px] bg-white rounded-xl border border-zinc-200 p-4 shadow-sm animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 h-[500px]">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-2 md:p-1">

      {/* Universal Interactive Chart View Engine */}
      <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
        <UniversalBarChart
          title="Overview"
          description="Institutional population metrics across student, faculty, and staff divisions."
          data={data}
          metrics={metrics}
          defaultMetricKey="population"
        />
      </div>

      {/* Visual Hierarchy Layout centered on the primary Orange accent */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Slot 1: Stacked Layered Area Layout — students (orange) vs faculty (dark) */}
        <UniversalAreaMiniChart
          title="Students vs Faculty"
          subtitle="Population mapped against teaching staff"
          data={data}
          dataKey="population"
          secondaryDataKey="personnel"
          color="#E85002"
          secondaryColor="#18181b"
          height={135}
        />

        {/* Slot 2: Teaching Staff line chart (crisp dark neutral) */}
        <UniversalLineMiniChart
          title="Teaching Staff"
          subtitle="Total faculty headcount"
          data={data}
          dataKey="personnel"
          color="#18181b"
          height={135}
        />

        {/* Slot 3: Student Body bar chart (core accent orange) */}
        <UniversalBarMiniChart
          title="Student Body"
          subtitle="Total enrolled student population"
          data={data}
          dataKey="population"
          color="#E85002"
          height={135}
        />

        {/* Slot 4: Support Staff bar chart (muted slate-zinc) */}
        <UniversalBarMiniChart
          title="Support Staff"
          subtitle="Total administrative staff"
          data={data}
          dataKey="support"
          color="#52525b"
          height={135}
        />
      </div>

    </div>
  )
}
