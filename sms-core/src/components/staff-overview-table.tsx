"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"
import { fetchWithAuth } from "@/lib/fetch-with-auth"


export type StaffOverviewRow = {
  id: string
  staffMeta: React.ReactNode
  department: string
  jobTitle: string
  employmentType: string
  shiftSchedule: string
  email: string
  phone: string
  priorInstitution: string
  salaryStatus: React.ReactNode
  status: React.ReactNode
}

interface StaffOverviewTableProps {
  data?: any[]
}

export function StaffOverviewTable({ data: initialData }: StaffOverviewTableProps) {
  const [staff, setStaff] = React.useState<any[]>(initialData || [])
  const [isLoading, setIsLoading] = React.useState(!initialData)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (initialData) {
      setStaff(initialData)
      setIsLoading(false)
      return
    }

    const liveRegistrySync = async () => {
      try {
        setIsLoading(true)
        const response = await fetchWithAuth("/staff")

        if (!response.ok) {
          throw new Error(`HTTP network execution failure: ${response.status}`)
        }

        const payload = await response.json()

        if (payload.success && Array.isArray(payload.data)) {
          setStaff(payload.data)
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

  const transformedData: StaffOverviewRow[] = React.useMemo(() => {
    const statusColorMap: Record<string, string> = {
      Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      "Pending Review": "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      Suspended: "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
    }

    const shiftLabelMap: Record<string, string> = {
      MORNING: "Morning",
      EVENING: "Evening",
      NIGHT: "Overnight",
    }

    const empTypeLabelMap: Record<string, string> = {
      FULL_TIME: "Full-Time",
      PART_TIME: "Part-Time",
      CONTRACT: "Contract",
    }

    return staff.map((item, index) => {
      const currentStatus = item.status || "Active"

      // ── SAFE VALUE EXTRACTION (MAPPED TO PRISMA RELATIONSHIPS) ──

      // 1. Account block
      const rawName = item.account?.fullName || item.staffName || item.name || "Unknown Staff"
      const rawEmail = item.account?.email || item.email || "N/A"

      // 2. Demographics block
      const rawPhone = item.demographics?.phone || item.phone || "—"
      const rawPriorSchool = item.demographics?.formerSchool || item.formerSchool || "—"

      // 3. Placement block
      const rawDept = item.placement?.departmentId || item.department || "—"
      const rawJobTitle = item.placement?.jobTitle || item.jobTitle || "—"
      const rawEmpType = item.placement?.employmentType || item.employmentType || "—"
      const rawShift = item.placement?.shiftSchedule || item.shiftSchedule || "—"

      // 4. Payroll block
      const rawSalaryStatus = item.payroll?.salaryStatus || item.salaryStatus || "PENDING"

      const fallbackId = item.staffId || item.id || `STF-${index}`

      return {
        id: fallbackId,
        staffMeta: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight">
            {rawName}
          </span>
        ),
        department: rawDept,
        jobTitle: rawJobTitle,
        employmentType: empTypeLabelMap[rawEmpType] || rawEmpType,
        shiftSchedule: shiftLabelMap[rawShift] || rawShift,
        email: rawEmail,
        phone: rawPhone,
        priorInstitution: rawPriorSchool,
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
  }, [staff])

  const columns = React.useMemo<DataTableColumn<StaffOverviewRow>[]>(() => [
    { key: "id", header: "Staff ID", className: "w-[110px]", cellClassName: "font-mono text-xs text-muted-foreground tracking-wider" },
    { key: "staffMeta", header: "Staff Member", className: "min-w-[150px]" },
    { key: "email", header: "Email Address", className: "min-w-[160px]", cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs truncate" },
    { key: "phone", header: "Mobile Phone", className: "w-[125px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "department", header: "Department", className: "min-w-[130px]", cellClassName: "text-zinc-600 dark:text-zinc-400 font-medium" },
    { key: "jobTitle", header: "Job Title", className: "min-w-[140px]", cellClassName: "text-zinc-600 dark:text-zinc-400" },
    { key: "priorInstitution", header: "Prior Institution", className: "min-w-[130px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "employmentType", header: "Type", className: "w-[90px]", cellClassName: "text-zinc-600 dark:text-zinc-400" },
    { key: "shiftSchedule", header: "Shift", className: "w-[90px]", cellClassName: "text-zinc-600 dark:text-zinc-400 text-center" },
    { key: "salaryStatus", header: "Salary Status", className: "w-[110px]" },
    { key: "status", header: "Status", className: "w-[110px]" },
  ], [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 w-full text-zinc-400 dark:text-zinc-500 text-xs font-mono tracking-tight animate-pulse">
        Syncing live staff registry matrix from database infrastructure...
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
      emptyMessage="No staff core registry metrics discovered."
    />
  )
}
