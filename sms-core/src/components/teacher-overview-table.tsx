"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

// Point this to your actual running Express backend server URL

export type TeacherOverviewRow = {
  id: string
  facultyMeta: React.ReactNode
  department: string
  subject: string
  employmentType: string
  yearsOfExperience: string
  email: string                     // ⚡ Re-added Email Column field
  phone: string                     
  formerSchool: string              
  salaryStatus: React.ReactNode     
  status: React.ReactNode
}

interface TeacherOverviewTableProps {
  data?: any[]
}

export function TeacherOverviewTable({ data: initialData }: TeacherOverviewTableProps) {
  const [teachers, setTeachers] = React.useState<any[]>(initialData || [])
  const [isLoading, setIsLoading] = React.useState(!initialData)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (initialData) {
      setTeachers(initialData)
      setIsLoading(false)
      return
    }

    const liveRegistrySync = async () => {
      try {
        setIsLoading(true)
        const response = await fetchWithAuth("/teachers")
        
        if (!response.ok) {
          throw new Error(`HTTP network execution failure: ${response.status}`)
        }
        
        const payload = await response.json()
        
        if (payload.success && Array.isArray(payload.data)) {
          setTeachers(payload.data)
        } else {
          throw new Error(payload.message || "Malformed pipeline structure encountered.")
        }
      } catch (err: any) {
        setError(err.message || "Failed to resolve connection to core service instance.")
      } finally {
        setIsLoading(false)
      }
    }

    liveRegistrySync()
  }, [initialData])

  const transformedData: TeacherOverviewRow[] = teachers.map((item) => {
    const currentStatus = item.status || "Active"
    const statusColorMap: Record<string, string> = {
      Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      "Pending Review": "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      Suspended: "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
    }

    // Safely parse either nested database payloads or root data formats
    const rawName = item.account?.fullName || item.name || "Unknown Faculty"
    const rawDept = item.placement?.departmentId || item.department || "—"
    const rawJob = item.placement?.jobTitle || item.subject || "—"
    const rawEmpType = item.placement?.employmentType || item.employmentType || "—"
    const rawEmail = item.account?.email || item.email || "N/A"
    const rawPhone = item.demographics?.phone || item.phone || "—"
    const rawPriorSchool = item.demographics?.formerSchool || item.formerSchool || "—"
    const rawSalaryStatus = item.payroll?.salaryStatus || item.salaryStatus || "PENDING"

    return {
      id: item.teacherId || item.id || `TCH-${Math.floor(Math.random() * 90000)}`,
      facultyMeta: (
        <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight">
          {rawName}
        </span>
      ),
      department: rawDept,
      subject: rawJob,
      employmentType: rawEmpType,
      yearsOfExperience: `${item.yearsOfExperience ?? 0} Yrs`,
      email: rawEmail,
      phone: rawPhone,
      formerSchool: rawPriorSchool,
      salaryStatus: (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">
          {rawSalaryStatus}
        </span>
      ),
      status: (
        <div className={statusColorMap[currentStatus] || "text-zinc-500 text-xs font-medium"}>
          {currentStatus}
        </div>
      ),
    }
  })

  const columns: DataTableColumn<TeacherOverviewRow>[] = [
    { key: "id", header: "ID", className: "w-[90px]", cellClassName: "font-mono text-xs text-muted-foreground" },
    { key: "facultyMeta", header: "Faculty Member", className: "min-w-[140px]" },
    { key: "email", header: "Email Address", className: "min-w-[160px]", cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs truncate" },
    { key: "phone", header: "Mobile Phone", className: "w-[120px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "department", header: "Department", className: "min-w-[130px]", cellClassName: "text-zinc-600 dark:text-zinc-400 font-medium" },
    { key: "subject", header: "Core Designation", className: "min-w-[130px]", cellClassName: "text-zinc-600 dark:text-zinc-400" },
    { key: "formerSchool", header: "Prior Institution", className: "min-w-[130px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "employmentType", header: "Type", className: "w-[90px]", cellClassName: "text-zinc-600 dark:text-zinc-400" },
    { key: "yearsOfExperience", header: "Experience", className: "w-[85px]", cellClassName: "font-mono text-zinc-600 dark:text-zinc-400 text-center" },
    { key: "salaryStatus", header: "Salary Status", className: "w-[110px]" },
    { key: "status", header: "Status", className: "w-[110px]" },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-500 text-xs font-mono tracking-tight">
        Syncing live faculty registry matrix from database infrastructure...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50/40 dark:bg-red-950/10 border border-red-200/40 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-mono">
        [Registry Sync Fault]: {error}
      </div>
    )
  }

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No teacher core registry metrics discovered."
    />
  )
}