"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

export type StaffWorkforceRow = {
  id: string
  name: React.ReactNode
  jobTitle: string
  department: string
  classification: React.ReactNode
  shiftSchedule: string
  status: React.ReactNode
}

interface StaffWorkforceTableProps {
  data: any[]
}

export function StaffWorkforceTable({ data: rawStaff }: StaffWorkforceTableProps) {
  const transformedData = React.useMemo(() => {
    const statusColors: Record<string, string> = {
      Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      OnLeave: "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      Suspended: "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
    }

    return rawStaff.map((item, index) => {
      const currentStatus = item.status || "Active"
      const fallbackId = item.staffId || item.id || `STF-${index}`
      const empType = item.placement?.employmentType || "Full-Time"

      return {
        id: fallbackId,
        name: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight block whitespace-nowrap">
            {item.staffName || "Unknown Employee"}
          </span>
        ),
        jobTitle: item.placement?.jobTitle || "General Staff",
        department: item.placement?.departmentId 
          ? item.placement.departmentId.toUpperCase().replace("DEPT-", "") 
          : "GENERAL",
        classification: (
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tracking-tight whitespace-nowrap ${
            empType.toLowerCase().includes("full")
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
              : "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
          }`}>
            {empType}
          </span>
        ),
        shiftSchedule: item.placement?.shiftSchedule || "Standard Day",
        status: (
          <div className={statusColors[currentStatus] || "text-zinc-500 text-xs font-medium"}>
            {currentStatus}
          </div>
        ),
      }
    })
  }, [rawStaff])

  const columns = React.useMemo<DataTableColumn<StaffWorkforceRow>[]>(() => [
    { key: "id", header: "Staff ID", className: "w-[120px]", cellClassName: "font-mono text-xs text-muted-foreground tracking-wider font-semibold whitespace-nowrap" },
    { key: "name", header: "Employee Name", className: "w-[140px]" },
    { key: "jobTitle", header: "Job Title", className: "w-[150px]", cellClassName: "text-zinc-700 dark:text-zinc-300 tracking-tight text-xs font-medium whitespace-nowrap" },
    { key: "department", header: "Department", className: "w-[110px]", cellClassName: "font-mono font-semibold text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap" },
    { key: "classification", header: "Classification", className: "w-[110px]" },
    // ── REMOVED MAX-WIDTH AND TRUNCATE — STRING SHOWS COMPLETELY ──
    { key: "shiftSchedule", header: "Workload Shift / Schedule", className: "w-[240px]", cellClassName: "text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap select-all" },
    { key: "status", header: "Status", className: "w-[100px]" },
  ], [])

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No operational workforce data matches current distribution arrays."
    />
  )
}