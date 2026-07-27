"use client"

import * as React from "react"
import {
  UniversalDataTable,
  type DataTableColumn,
} from "@/components/universal-data-table"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

type StaffPerformanceApiRow = {
  id: string
  staffId: string
  staffName: string
  email?: string | null
  role?: string | null
  departmentId: string
  jobTitle: string
  employmentType: string
  shiftSchedule: string
  status: string
  tenureDays: number
  profileCompleteness: number
  complianceScore: number
  payrollReadiness: number
  performanceScore: number
  reviewStatus: string
  attendanceRate: number | null
  punctualityRate: number | null
  taskCompletionRate: number | null
  metricsSource: string
  notes?: string
}

export type StaffWorkforceRow = {
  id: string
  name: React.ReactNode
  jobTitle: string
  department: string
  profileCompleteness: React.ReactNode
  complianceScore: React.ReactNode
  payrollReadiness: React.ReactNode
  performanceScore: React.ReactNode
  reviewStatus: React.ReactNode
  metricCoverage: string
}

interface StaffWorkforceTableProps {
  data?: any[]
}

function metricClass(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
  }

  if (value >= 85) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
  }

  if (value >= 65) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
  }

  return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400"
}

function MetricPill({ value }: { value: number | null | undefined }) {
  return (
    <span
      className={`inline-flex min-w-[56px] justify-center rounded border px-2 py-0.5 text-xs font-semibold ${metricClass(
        value
      )}`}
    >
      {value === null || value === undefined ? "N/A" : `${value}%`}
    </span>
  )
}

function ReviewStatusPill({ value }: { value: string }) {
  const className =
    value === "On Track"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
      : value === "Needs Review"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400"

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}
    >
      {value}
    </span>
  )
}

export function StaffWorkforceTable({ data: visibleStaff = [] }: StaffWorkforceTableProps) {
  const [performanceRows, setPerformanceRows] = React.useState<
    StaffPerformanceApiRow[]
  >([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true

    const loadPerformanceMetrics = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetchWithAuth("/staff/performance")

        if (!response.ok) {
          throw new Error(`HTTP network execution failure: ${response.status}`)
        }

        const payload = await response.json()

        if (!payload?.success || !Array.isArray(payload.data)) {
          throw new Error(
            payload?.message || "Malformed staff performance payload."
          )
        }

        if (isMounted) {
          setPerformanceRows(payload.data)
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load staff performance metrics."
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadPerformanceMetrics()

    return () => {
      isMounted = false
    }
  }, [])

  const visibleStaffKeys = React.useMemo(() => {
    return new Set(
      visibleStaff
        .map((item) => item.staffId || item.id)
        .filter(Boolean)
        .map(String)
    )
  }, [visibleStaff])

  const filteredPerformanceRows = React.useMemo(() => {
    if (visibleStaffKeys.size === 0) {
      return performanceRows
    }

    return performanceRows.filter(
      (row) => visibleStaffKeys.has(row.staffId) || visibleStaffKeys.has(row.id)
    )
  }, [performanceRows, visibleStaffKeys])

  const transformedData = React.useMemo<StaffWorkforceRow[]>(() => {
    return filteredPerformanceRows.map((item, index) => {
      const fallbackId = item.staffId || item.id || `STF-${index}`
      const department = item.departmentId
        ? item.departmentId.toUpperCase().replace("DEPT-", "")
        : "GENERAL"

      const futureMetricsAvailable =
        item.attendanceRate !== null ||
        item.punctualityRate !== null ||
        item.taskCompletionRate !== null

      return {
        id: fallbackId,
        name: (
          <span className="block whitespace-nowrap font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            {item.staffName || "Unknown Employee"}
          </span>
        ),
        jobTitle: item.jobTitle || "General Staff",
        department,
        profileCompleteness: <MetricPill value={item.profileCompleteness} />,
        complianceScore: <MetricPill value={item.complianceScore} />,
        payrollReadiness: <MetricPill value={item.payrollReadiness} />,
        performanceScore: <MetricPill value={item.performanceScore} />,
        reviewStatus: <ReviewStatusPill value={item.reviewStatus} />,
        metricCoverage: futureMetricsAvailable
          ? "Attendance/task metrics connected"
          : "Registry, compliance, payroll metrics",
      }
    })
  }, [filteredPerformanceRows])

  const columns = React.useMemo<DataTableColumn<StaffWorkforceRow>[]>(
    () => [
      {
        key: "id",
        header: "Staff ID",
        className: "w-[120px]",
        cellClassName:
          "font-mono text-xs text-muted-foreground tracking-wider font-semibold whitespace-nowrap",
      },
      { key: "name", header: "Employee Name", className: "w-[150px]" },
      {
        key: "jobTitle",
        header: "Job Title",
        className: "w-[150px]",
        cellClassName:
          "text-zinc-700 dark:text-zinc-300 tracking-tight text-xs font-medium whitespace-nowrap",
      },
      {
        key: "department",
        header: "Department",
        className: "w-[110px]",
        cellClassName:
          "font-mono font-semibold text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap",
      },
      {
        key: "profileCompleteness",
        header: "Profile",
        className: "w-[90px]",
      },
      {
        key: "complianceScore",
        header: "Compliance",
        className: "w-[105px]",
      },
      {
        key: "payrollReadiness",
        header: "Payroll",
        className: "w-[90px]",
      },
      {
        key: "performanceScore",
        header: "Score",
        className: "w-[90px]",
      },
      {
        key: "reviewStatus",
        header: "Review Status",
        className: "w-[120px]",
      },
      {
        key: "metricCoverage",
        header: "Metric Source",
        className: "w-[210px]",
        cellClassName:
          "text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap",
      },
    ],
    []
  )

  if (isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center text-xs font-mono tracking-tight text-zinc-400 animate-pulse dark:text-zinc-500">
        Loading staff performance metrics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="m-4 rounded-lg border border-red-200/40 bg-red-50/20 p-4 text-xs font-mono text-red-600 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400">
        [Performance Metrics Fault]: {error}
      </div>
    )
  }

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No staff performance metrics match current distribution arrays."
    />
  )
}
