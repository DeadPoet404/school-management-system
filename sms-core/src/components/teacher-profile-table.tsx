"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

export type TeacherProfileRow = {
  id: string
  teacherName: React.ReactNode
  institutionalEmail: string                     
  religion: string                     
  gender: string              
  mobileNumber: string     
  bloodGroup: string
  dateOfBirth: string
  primaryAddress: string
  priorEducation: string
  ghanaCard: string
  emergencyContact: string
}

interface TeacherProfileTableProps {
  data?: any[]
}

export function TeacherProfileTable({ data: initialData }: TeacherProfileTableProps) {
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

  const transformedData = React.useMemo(() => {
    return teachers.map((item, index) => {
      // 1. Full Legal Name mapping from the account block
      const rawName = item.account?.fullName || item.teacherName || item.name || "Unknown Teacher"
      
      // 2. Institutional email mapping
      const rawEmail = item.account?.email || item.institutionalEmail || item.email || "N/A"
      
      // 3. Demographics block fields (Direct match to your form data keys)
      const rawMobile = item.demographics?.phone || item.mobileNumber || item.phone || "—"
      const rawReligion = item.demographics?.religion || item.religion || "—"
      const rawGender = item.demographics?.gender || item.gender || "—"
      const rawBloodGroup = item.demographics?.bloodType || item.bloodGroup || item.bloodType || "—"
      const rawDob = item.demographics?.dateOfBirth || item.dateOfBirth || "—"
      const rawAddress = item.demographics?.residentialAddress || item.primaryResidentialAddress || item.address || "—"
      const rawPriorEdu = item.demographics?.formerSchool || item.priorEducation || item.formerSchool || "—"
      
      // 4. Compliance block fields (Traces through your wizard's structure)
      const rawGhanaCard = item.compliance?.nationalId || item.identity?.ghanaCard || item.ghanaCard || "—"
      const rawEmergency = item.compliance?.emergencyContact?.phone || item.emergencyContactNumber || "—"

      const fallbackId = `TCH-prof-${rawEmail.replace(/[^a-zA-Z0-9]/g, "") || index}`

      return {
        id: item.teacherId || item.id || fallbackId,
        teacherName: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight">
            {rawName}
          </span>
        ),
        institutionalEmail: rawEmail,
        religion: rawReligion,
        gender: rawGender,
        mobileNumber: rawMobile,
        bloodGroup: rawBloodGroup,
        dateOfBirth: rawDob,
        primaryAddress: rawAddress,
        priorEducation: rawPriorEdu,
        ghanaCard: rawGhanaCard,
        emergencyContact: rawEmergency,
      }
    })
  }, [teachers])

  const columns = React.useMemo<DataTableColumn<TeacherProfileRow>[]>(() => [
    { key: "id", header: "Teacher ID", className: "w-[110px]", cellClassName: "font-mono text-xs text-muted-foreground" },
    { key: "teacherName", header: "Teacher Name", className: "min-w-[140px]" },
    { key: "institutionalEmail", header: "Institutional Email", className: "min-w-[170px]", cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs truncate" },
    { key: "gender", header: "Gender", className: "w-[90px]", cellClassName: "text-zinc-600 dark:text-zinc-400 text-xs capitalize" },
    { key: "mobileNumber", header: "Mobile Number", className: "w-[130px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "ghanaCard", header: "National ID / Ghana Card", className: "w-[140px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "dateOfBirth", header: "Date of Birth", className: "w-[110px]", cellClassName: "font-mono text-xs text-zinc-500" },
    { key: "bloodGroup", header: "Blood Group", className: "w-[90px]", cellClassName: "text-center font-medium text-xs text-red-600 dark:text-red-400" },
    { key: "religion", header: "Religion", className: "w-[110px]", cellClassName: "text-zinc-600 dark:text-zinc-400 text-xs" },
    { key: "primaryAddress", header: "Primary Address", className: "min-w-[160px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "priorEducation", header: "Prior Education", className: "min-w-[140px]", cellClassName: "text-zinc-500 dark:text-zinc-400 truncate text-xs" },
    { key: "emergencyContact", header: "Emergency Contact", className: "w-[130px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
  ], [])

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
