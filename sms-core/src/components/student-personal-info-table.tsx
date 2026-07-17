"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

export type StudentPersonalInfoRow = {
  id: string
  studentMeta: React.ReactNode
  email: string
  religion: string
  gender: string
  phone: string
  bloodType: string
  dateOfBirth: string
  address: string
  formerSchool: string
  ghanaCard: string
  emergencyContact: string
  status: React.ReactNode
}

interface StudentPersonalInfoTableProps {
  data?: any[]
}

export function StudentPersonalInfoTable({ data: initialData }: StudentPersonalInfoTableProps) {
  const [students, setStudents] = React.useState<any[]>(initialData || [])
  const [isLoading, setIsLoading] = React.useState(!initialData)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (initialData) {
      setStudents(initialData)
      setIsLoading(false)
      return
    }

    const liveRegistrySync = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("${process.env.NEXT_PUBLIC_API_URL}/students")

        if (!response.ok) {
          throw new Error(`HTTP network execution failure: ${response.status}`)
        }

        const payload = await response.json()

        if (payload.success && Array.isArray(payload.data)) {
          setStudents(payload.data)
        } else if (Array.isArray(payload)) {
          setStudents(payload)
        } else if (payload && Array.isArray(payload.data)) {
          setStudents(payload.data)
        } else {
          throw new Error("Malformed profile pipeline structure encountered.")
        }
      } catch (err: any) {
        setError(err.message || "Failed to resolve connection to core service instance.")
      } finally {
        setIsLoading(false)
      }
    }

    liveRegistrySync()
  }, [initialData])

  const transformedData = React.useMemo(() => {
    const statusColorMap: Record<string, string> = {
      Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      Suspended: "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      "Pending Review": "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
    }

    return students.map((item, index) => {
      const currentStatus = item.status || "Active"

      // ── SAFE VALUE EXTRACTION (MAPPED DIRECTLY TO PRISMA STRUCT RELATIONSHIPS) ──

      // 1. Account block
      const rawName = item.studentName || item.account?.fullName || item.name || "Unknown Student"
      const rawEmail = item.account?.email || item.account?.portalEmail || item.email || "—"

      // 2. Demographics block fields
      const rawReligion = item.demographics?.religion || item.religion || "—"
      const rawAddress = item.demographics?.residentialAddress || item.address || "—"
      const rawPriorSchool = item.demographics?.formerSchool || item.formerSchool || "—"

      let rawGender = item.demographics?.gender || item.gender || "—"
      if (typeof rawGender === "string") {
        const lower = rawGender.toLowerCase()
        if (lower.startsWith("m")) rawGender = "Male"
        else if (lower.startsWith("f")) rawGender = "Female"
      }

      const rawBloodType = item.demographics?.bloodType || item.bloodType || "—"
      const formattedBlood = rawBloodType
        .replace("A_PLUS", "A+").replace("A_MINUS", "A-")
        .replace("B_PLUS", "B+").replace("B_MINUS", "B-")
        .replace("AB_PLUS", "AB+").replace("AB_MINUS", "AB-")
        .replace("O_PLUS", "O+").replace("O_MINUS", "O-")

      const rawDob = item.demographics?.dateOfBirth || item.dateOfBirth
      const formattedDob = rawDob
        ? new Date(rawDob).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "—"

      // 3. Guardian block
      const rawPhone = item.guardian?.phone || item.phone || "—"

      // 4. Compliance block (Traces through your wizard's compliance structure)
      const rawGhanaCard = item.compliance?.nationalId || item.ghanaCard || item.nationalId || "—"
      const rawEmergency = item.compliance?.emergencyPhone || item.emergencyContactNumber || "—"
      const fallbackId = item.studentId || item.id || `STD-${index}`

      return {
        id: fallbackId,
        studentMeta: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight">
            {rawName}
          </span>
        ),
        email: rawEmail,
        religion: rawReligion,
        gender: rawGender,
        phone: rawPhone,
        bloodType: formattedBlood,
        dateOfBirth: formattedDob,
        address: rawAddress,
        formerSchool: rawPriorSchool,
        ghanaCard: rawGhanaCard,
        emergencyContact: rawEmergency,
        status: (
          <div className={statusColorMap[currentStatus] || "text-zinc-500 text-xs font-medium"}>
            {currentStatus}
          </div>
        ),
      }
    })
  }, [students])

  const columns = React.useMemo<DataTableColumn<StudentPersonalInfoRow>[]>(() => [
    { key: "id", header: "Student ID", className: "w-[110px]", cellClassName: "font-mono text-xs text-muted-foreground tracking-wider" },
    { key: "studentMeta", header: "Student Name", className: "min-w-[150px]" },
    { key: "email", header: "Institutional Email", className: "min-w-[170px]", cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs truncate" },
    {
      key: "gender",
      header: "Gender",
      className: "w-[85px]",
      cell: (row) => {
        const isMale = row.gender === "Male"
        const isFemale = row.gender === "Female"
        return (
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tracking-tight ${
            isMale
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
              : isFemale
              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
              : "bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          }`}>
            {row.gender}
          </span>
        )
      }
    },
    { key: "phone", header: "Mobile Number", className: "w-[125px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "ghanaCard", header: "National ID / Ghana Card", className: "w-[145px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400 tracking-tight" },
    { key: "dateOfBirth", header: "Date of Birth", className: "w-[115px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "bloodType", header: "Blood Group", className: "w-[95px]", cellClassName: "font-mono font-semibold text-zinc-700 dark:text-zinc-300 text-center text-xs" },
    { key: "religion", header: "Religion", className: "w-[100px]", cellClassName: "text-zinc-600 dark:text-zinc-400 text-xs font-medium" },
    { key: "address", header: "Primary Address", className: "min-w-[160px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "formerSchool", header: "Prior Education", className: "min-w-[140px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "emergencyContact", header: "Emergency Contact", className: "w-[130px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "status", header: "Status", className: "w-[100px]" },
  ], [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 w-full text-zinc-400 dark:text-zinc-500 text-xs font-mono tracking-tight animate-pulse">
        Syncing live student registry matrix from database infrastructure...
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
      emptyMessage="No student core registry metrics discovered."
    />
  )
}