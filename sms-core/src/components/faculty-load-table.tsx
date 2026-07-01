"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

export type FacultyLoadRow = {
  id: string
  name: React.ReactNode
  department: string
  subjectLoad: string
  academicTrack: string
  weeklyHours: string
  status: React.ReactNode
}

interface FacultyLoadTableProps {
  data: any[]
}

export function FacultyLoadTable({ data: rawTeachers }: FacultyLoadTableProps) {
  const transformedData = React.useMemo(() => {
    return rawTeachers.map((item, index) => {
      const fallbackId = item.teacherId || item.id || `TCH-${index}`
      const trackStr = item.placement?.academicTrack || item.academicTrack || "General Arts"
      const hoursCount = item.weeklyHours || 0

      return {
        id: fallbackId,
        name: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight block whitespace-nowrap">
            {item.account?.fullName || item.teacherName || "Unknown Faculty"}
          </span>
        ),
        department: item.placement?.departmentId 
          ? item.placement.departmentId.toUpperCase().replace("DEPT-", "") 
          : "ACADEMICS",
        subjectLoad: item.placement?.jobTitle || item.subject || "Core Subjects",
        academicTrack: trackStr,
        weeklyHours: hoursCount > 0 ? `${hoursCount} Periods` : "—",
        status: (
          <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium whitespace-nowrap">
            {item.status || "Active"}
          </div>
        ),
      }
    })
  }, [rawTeachers])

  const columns = React.useMemo<DataTableColumn<FacultyLoadRow>[]>(() => [
    { key: "id", header: "Teacher ID", className: "w-[120px]", cellClassName: "font-mono text-xs text-muted-foreground tracking-wider font-semibold whitespace-nowrap" },
    { key: "name", header: "Faculty Name", className: "w-[150px]" },
    { key: "department", header: "Department", className: "w-[110px]", cellClassName: "font-mono font-semibold text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap" },
    { key: "subjectLoad", header: "Assigned Subject", className: "w-[160px]", cellClassName: "text-zinc-700 dark:text-zinc-300 text-xs font-medium whitespace-nowrap" },
    { key: "academicTrack", header: "Academic Track", className: "w-[140px]", cellClassName: "text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap" },
    { key: "weeklyHours", header: "Weekly Load", className: "w-[120px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap" },
    { key: "status", header: "Status", className: "w-[100px]" },
  ], [])

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No teaching allocations mapped to current curriculum layouts."
    />
  )
}