"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

const BACKEND_API_URL = "http://localhost:5000/api/staff"

export type StaffProfileRow = {
  id: string
  staffMeta: React.ReactNode
  email: string
  gender: string
  phone: string
  bloodGroup: string
  dateOfBirth: string
  religion: string
  address: string
  priorInstitution: string
  ghanaCard: string
  ssnitNumber: string
  emergencyName: string
  emergencyPhone: string
  status: React.ReactNode
}

interface StaffProfileTableProps {
  data?: any[]
}

export function StaffProfileTable({ data: initialData }: StaffProfileTableProps) {
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
        const response = await fetch(BACKEND_API_URL)

        if (!response.ok) {
          throw new Error(`HTTP network execution failure: ${response.status}`)
        }

        const payload = await response.json()

        if (payload.success && Array.isArray(payload.data)) {
          setStaff(payload.data)
        } else {
          throw new Error(payload.message || "Malformed profile pipeline structure encountered.")
        }
      } catch (err: any) {
        setError(err.message || "Failed to resolve connection to core service instance.")
      } finally {
        setIsLoading(false)
      }
    }

    liveRegistrySync()
  }, [initialData])

  const transformedData: StaffProfileRow[] = React.useMemo(() => {
    const statusColorMap: Record<string, string> = {
      Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      "Pending Review": "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      Suspended: "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
    }

    const genderLabelMap: Record<string, string> = {
      MALE: "Male",
      FEMALE: "Female",
      OTHER: "Other",
    }

    const bloodLabelMap: Record<string, string> = {
      A_PLUS: "A+",
      A_MINUS: "A-",
      B_PLUS: "B+",
      B_MINUS: "B-",
      AB_PLUS: "AB+",
      AB_MINUS: "AB-",
      O_PLUS: "O+",
      O_MINUS: "O-",
    }

    return staff.map((item, index) => {
      const currentStatus = item.status || "Active"

      // ── SAFE VALUE EXTRACTION (MAPPED TO PRISMA RELATIONSHIPS) ──

      // 1. Account block
      const rawName = item.account?.fullName || item.staffName || item.name || "Unknown Staff"
      const rawEmail = item.account?.email || item.email || "—"

      // 2. Demographics block (personal fields unique to the individual)
      const rawGender = item.demographics?.gender || item.gender || "—"
      const rawPhone = item.demographics?.phone || item.phone || "—"
      const rawBloodType = item.demographics?.bloodType || item.bloodType || "—"
      const rawDob = item.demographics?.dateOfBirth || item.dateOfBirth
      const formattedDob = rawDob
        ? new Date(rawDob).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "—"
      const rawReligion = item.demographics?.religion || item.religion || "—"
      const rawAddress = item.demographics?.residentialAddress || item.address || "—"
      const rawPriorSchool = item.demographics?.formerSchool || item.formerSchool || "—"

      // 3. Compliance block (identity documents unique to the individual)
      const rawGhanaCard = item.compliance?.nationalId || "—"
      const rawSsnit = item.compliance?.ssnitNumber || "—"
      const rawEmergName = item.compliance?.emergencyName || "—"
      const rawEmergPhone = item.compliance?.emergencyPhone || "—"

      const fallbackId = item.staffId || item.id || `STF-${index}`

      return {
        id: fallbackId,
        staffMeta: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight">
            {rawName}
          </span>
        ),
        email: rawEmail,
        gender: genderLabelMap[rawGender] || rawGender,
        phone: rawPhone,
        bloodGroup: bloodLabelMap[rawBloodType] || rawBloodType,
        dateOfBirth: formattedDob,
        religion: rawReligion,
        address: rawAddress,
        priorInstitution: rawPriorSchool,
        ghanaCard: rawGhanaCard,
        ssnitNumber: rawSsnit,
        emergencyName: rawEmergName,
        emergencyPhone: rawEmergPhone,
        status: (
          <div className={statusColorMap[currentStatus] || "text-zinc-500 text-xs font-medium"}>
            {currentStatus}
          </div>
        ),
      }
    })
  }, [staff])

  const columns = React.useMemo<DataTableColumn<StaffProfileRow>[]>(() => [
    { key: "id", header: "Staff ID", className: "w-[130px]", cellClassName: "font-mono text-xs text-muted-foreground tracking-wider" },
    { key: "staffMeta", header: "Staff Name", className: "min-w-[180px]" },
    { key: "email", header: "Institutional Email", className: "min-w-[220px]", cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs truncate" },
    { key: "gender", header: "Gender", className: "w-[100px]", cellClassName: "text-zinc-600 dark:text-zinc-400 text-xs" },
    { key: "phone", header: "Mobile Number", className: "w-[150px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "ghanaCard", header: "National ID / Ghana Card", className: "w-[180px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400 tracking-tight" },
    { key: "dateOfBirth", header: "Date of Birth", className: "w-[140px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "bloodGroup", header: "Blood Group", className: "w-[110px]", cellClassName: "text-center font-medium text-red-600 dark:text-red-400 text-xs" },
    { key: "religion", header: "Religion", className: "w-[120px]", cellClassName: "text-zinc-600 dark:text-zinc-400 text-xs font-medium" },
    { key: "address", header: "Primary Address", className: "min-w-[240px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "priorInstitution", header: "Prior Institution", className: "min-w-[200px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "emergencyName", header: "Emergency Contact", className: "min-w-[180px]", cellClassName: "text-zinc-600 dark:text-zinc-400" },
    { key: "emergencyPhone", header: "Emergency Phone", className: "w-[150px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "status", header: "Status", className: "w-[130px]" },
  ], [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 w-full text-zinc-400 dark:text-zinc-500 text-xs font-mono tracking-tight animate-pulse">
        Syncing live staff profile registry matrix from database infrastructure...
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
      emptyMessage="No staff profile records matched."
    />
  )
}