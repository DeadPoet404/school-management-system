"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Plus, RefreshCw, UserMinus } from "lucide-react"

import { ModuleTabs } from "@/components/module-tabs"
import { UniversalSearch } from "@/components/universal-search"
import { TeacherRegistryFilter } from "@/components/teacher-registry-filter"
import { ActionDropdown } from "@/components/action-dropdown"
import { Button } from "@/components/ui/button"

import { TeacherOverviewTable } from "@/components/teacher-overview-table"
import { TeacherProfileTable } from "@/components/teacher-profile-table"
import { FacultyLoadTable } from "@/components/faculty-load-table"
import { FacultyPayrollTable } from "@/components/faculty-payroll-table"

import { fetchWithAuth } from "@/lib/fetch-with-auth"

const teacherTabs = [
  {
    value: "overview",
    label: "Overview",
    title: "Teacher Overview",
    description:
      "View teacher employment status, department assignment, contact information, and active standing.",
  },
  {
    value: "personal-info",
    label: "Personal Info",
    title: "Personal Information",
    description:
      "View and manage teacher personal details, contact information, and demographic data.",
  },
  {
    value: "assignments",
    label: "Assignments",
    title: "Class and Subject Assignments",
    description:
      "Manage teaching schedules, assigned classes, and subject allocations.",
  },
  {
    value: "compensation",
    label: "Compensation",
    title: "Teacher Compensation Records",
    description:
      "Monitor salary bands, pay history, deductions, and benefits enrollment.",
  },
]

type TeacherRow = {
  id: string
  teacherId: string
  teacherName?: string
  department?: string
  subject?: string
  status?: string
  employmentType?: string
  qualification?: string
  yearsOfExperience?: number
  licenseStatus?: string
  assignedClasses?: number
  weeklyHours?: number
  baseSalary?: number
  totalDeductions?: number
  netPay?: number
  email?: string
  phone?: string
  hireDate?: string
  account?: {
    fullName?: string
    email?: string
    role?: string
  }
  placement?: {
    departmentId?: string
    jobTitle?: string
    employmentType?: string
  }
  demographics?: {
    phone?: string
  }
  payroll?: {
    baseSalary?: number
    deductions?: number
    netPay?: number
  }
}

export default function TeachersPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>(
    {}
  )

  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [isRegistrySyncing, setIsRegistrySyncing] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadTeachers = useCallback(async () => {
    try {
      setIsRegistrySyncing(true)
      setFetchError(null)

      const response = await fetchWithAuth("/teachers?limit=500")

      if (!response.ok) {
        throw new Error(`HTTP network error: ${response.status}`)
      }

      const payload = await response.json()

      if (payload?.success && Array.isArray(payload.data)) {
        setTeachers(payload.data)
        return
      }

      if (Array.isArray(payload?.data)) {
        setTeachers(payload.data)
        return
      }

      if (Array.isArray(payload)) {
        setTeachers(payload)
        return
      }

      throw new Error("The teachers endpoint returned an unexpected data structure.")
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "Unable to load faculty records. Please try again."
      )
    } finally {
      setIsRegistrySyncing(false)
    }
  }, [])

  useEffect(() => {
    void loadTeachers()
  }, [loadTeachers])

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      const name =
        teacher.teacherName ??
        teacher.account?.fullName ??
        "Unknown Faculty"

      const id = teacher.teacherId ?? teacher.id ?? ""

      const department =
        teacher.placement?.departmentId ??
        teacher.department ??
        ""

      const job =
        teacher.placement?.jobTitle ??
        teacher.subject ??
        ""

      const employmentType =
        teacher.placement?.employmentType ??
        teacher.employmentType ??
        ""

      const email =
        teacher.account?.email ??
        teacher.email ??
        ""

      const status = teacher.status ?? "ACTIVE"

      const query = searchQuery.toLowerCase().trim()

      if (query) {
        const matchesSearch =
          String(name).toLowerCase().includes(query) ||
          String(id).toLowerCase().includes(query) ||
          String(department).toLowerCase().includes(query) ||
          String(job).toLowerCase().includes(query) ||
          String(email).toLowerCase().includes(query)

        if (!matchesSearch) {
          return false
        }
      }

      if (
        advancedFilters.employmentStatus &&
        status !== advancedFilters.employmentStatus
      ) {
        return false
      }

      if (
        advancedFilters.department &&
        department !== advancedFilters.department
      ) {
        return false
      }

      if (
        advancedFilters.employmentType &&
        employmentType !== advancedFilters.employmentType
      ) {
        return false
      }

      if (
        advancedFilters.qualification &&
        teacher.qualification !== advancedFilters.qualification
      ) {
        return false
      }

      if (
        advancedFilters.minExperience &&
        Number(teacher.yearsOfExperience ?? 0) <
          Number.parseFloat(advancedFilters.minExperience)
      ) {
        return false
      }

      if (
        advancedFilters.licenseStatus &&
        teacher.licenseStatus !== advancedFilters.licenseStatus
      ) {
        return false
      }

      return true
    })
  }, [teachers, searchQuery, advancedFilters])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSearchQuery("")
    setAdvancedFilters({})
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    window.alert(
      `Selected "${file.name}". Faculty import processing has not been connected to the backend yet.`
    )

    event.target.value = ""
  }

  return (
    <div className="flex h-screen min-h-0 w-full flex-col space-y-4 overflow-hidden px-6 pt-6 pb-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="shrink-0">
        <h1 className="text-4xl font-medium tracking-tight text-foreground">
          Teacher Management System
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Comprehensive teacher management system for tracking employment
          status, qualifications, class assignments, and compensation records.
        </p>
      </div>

      <div className="flex w-full shrink-0 flex-col justify-between gap-4 border-b border-zinc-100 pt-4 pb-3 dark:border-zinc-900 lg:flex-row lg:items-center">
        <div className="mt-1 mb-[-8px]">
          <ModuleTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            tabs={teacherTabs}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <UniversalSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search teachers, IDs..."
            className="w-[200px]"
          />

          <TeacherRegistryFilter onApplyFilters={setAdvancedFilters} />

          <ActionDropdown
            label="Import"
            menuLabel="Import Options"
            items={[
              {
                label: "Upload CSV / XLSX",
                icon: FileSpreadsheet,
                onClick: handleUploadClick,
              },
              {
                label: "Sync HR Data",
                icon: RefreshCw,
                onClick: () => void loadTeachers(),
              },
            ]}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/teachers/departure")}
            className="h-9 gap-1.5 border-zinc-200 px-3 text-xs font-medium tracking-wide text-zinc-700 shadow-none transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
          >
            <UserMinus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Record Exit</span>
          </Button>

          <Button
            type="button"
            onClick={() => router.push("/teachers/add")}
            className="h-9 gap-1.5 bg-zinc-900 px-3 text-xs font-medium tracking-wide text-zinc-50 shadow-none transition-colors hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Teacher</span>
          </Button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-md bg-background">
        {isRegistrySyncing ? (
          <div className="flex h-48 items-center justify-center text-xs font-mono tracking-tight text-zinc-400 animate-pulse dark:text-zinc-500">
            Syncing live faculty registry records...
          </div>
        ) : fetchError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">{fetchError}</p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadTeachers()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="h-full w-full overflow-x-auto">
            <div className="min-w-max pr-4">
              {activeTab === "overview" && (
                <TeacherOverviewTable data={filteredTeachers} />
              )}

              {activeTab === "personal-info" && (
                <TeacherProfileTable data={filteredTeachers} />
              )}

              {activeTab === "assignments" && (
                <FacultyLoadTable data={filteredTeachers} />
              )}

              {activeTab === "compensation" && (
                <FacultyPayrollTable data={filteredTeachers} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}