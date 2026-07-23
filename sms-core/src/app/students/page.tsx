"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, LogOut, Plus, RefreshCw } from "lucide-react"

import { ModuleTabs } from "@/components/module-tabs"
import { UniversalSearch } from "@/components/universal-search"
import { StudentRegistryFilter } from "@/components/student-registry-filter"
import { ActionDropdown } from "@/components/action-dropdown"
import { Button } from "@/components/ui/button"

import { StudentOverviewTable } from "@/components/student-overview-table"
import { StudentPersonalInfoTable } from "@/components/student-personal-info-table"
import { StudentFinancialTable } from "@/components/student-financial-table"

import { fetchWithAuth } from "@/lib/fetch-with-auth"

const studentTabs = [
  {
    value: "overview",
    label: "Overview",
    title: "Student Overview",
    description:
      "View student academic performance, enrollment status, guardian contact information, and financial standing.",
  },
  {
    value: "personal-info",
    label: "Personal Info",
    title: "Personal Information",
    description: "View and manage student personal details and contact information.",
  },
  {
    value: "financial-info",
    label: "Fees Info",
    title: "Fee Information",
    description: "View and manage student fee records and payment history.",
  },
]

type StudentRecord = Record<string, any>

const StudentsPage = () => {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({})

  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetchWithAuth("/students?limit=500")

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const json = await response.json()

      if (json?.success && Array.isArray(json.data)) {
        setStudents(json.data)
        return
      }

      if (Array.isArray(json?.data)) {
        setStudents(json.data)
        return
      }

      if (Array.isArray(json)) {
        setStudents(json)
        return
      }

      throw new Error("The students endpoint returned an unexpected data structure.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load students.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSearchQuery("")
    setAdvancedFilters({})
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    window.alert(
      `Selected "${file.name}". Import processing is not connected to the backend yet.`
    )

    event.target.value = ""
  }

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const query = searchQuery.toLowerCase().trim()

      if (query) {
        const rawName =
          student.studentName ??
          student.name ??
          student.account?.fullName ??
          ""

        const rawId = student.studentId ?? student.id ?? ""

        const rawClass =
          student.placement?.class?.name ??
          student.placement?.classId ??
          student.class ??
          ""

        const rawGuardian =
          student.guardians?.[0]?.name ??
          student.guardian?.name ??
          ""

        const matchesSearch =
          String(rawName).toLowerCase().includes(query) ||
          String(rawId).toLowerCase().includes(query) ||
          String(rawClass).toLowerCase().includes(query) ||
          String(rawGuardian).toLowerCase().includes(query)

        if (!matchesSearch) {
          return false
        }
      }

      if (
        advancedFilters.academicStanding &&
        student.status !== advancedFilters.academicStanding
      ) {
        return false
      }

      if (
        advancedFilters.gradeLevel &&
        student.placement?.classId !== advancedFilters.gradeLevel
      ) {
        return false
      }

      if (
        advancedFilters.major &&
        student.placement?.academicTrack !== advancedFilters.major
      ) {
        return false
      }

      if (
        advancedFilters.minGpa &&
        Number(student.currentGpa ?? 0) <
          Number.parseFloat(advancedFilters.minGpa)
      ) {
        return false
      }

      if (
        advancedFilters.minAttendance &&
        Number(student.attendanceRate ?? 0) <
          Number.parseFloat(advancedFilters.minAttendance)
      ) {
        return false
      }

      return true
    })
  }, [students, searchQuery, advancedFilters])

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
          Student Management System
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Comprehensive student management system for tracking academic
          performance, enrollment status, guardian relationships, and financial
          standing.
        </p>
      </div>

      <div className="flex w-full shrink-0 flex-col justify-between gap-4 border-b border-zinc-100 pt-4 pb-3 dark:border-zinc-900 lg:flex-row lg:items-center">
        <div className="mt-1 mb-[-8px]">
          <ModuleTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            tabs={studentTabs}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <UniversalSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search students, IDs..."
            className="w-[200px]"
          />

          <StudentRegistryFilter onApplyFilters={setAdvancedFilters} />

          <ActionDropdown
            label="Import"
            menuLabel="Import Options"
            items={[
              {
                label: "Upload CSV / XLSX",
                icon: FileSpreadsheet,
                onClick: handleImportClick,
              },
              {
                label: "Sync Student Data",
                icon: RefreshCw,
                onClick: () => void loadStudents(),
              },
            ]}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/students/departure")}
            className="h-9 gap-1.5 border-zinc-200 px-3 text-xs font-medium tracking-wide text-zinc-700 shadow-none transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
          >
            <LogOut className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Record Departure</span>
          </Button>

          <Button
            type="button"
            onClick={() => router.push("/students/add")}
            className="h-9 gap-1.5 bg-zinc-900 px-3 text-xs font-medium tracking-wide text-zinc-50 shadow-none transition-colors hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Student</span>
          </Button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-md bg-background">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-xs font-mono tracking-tight text-zinc-400 animate-pulse dark:text-zinc-500">
            Syncing student registry records...
          </div>
        ) : error ? (
          <div className="m-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200/40 bg-red-50/20 p-4 text-xs font-mono text-red-600 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400">
            <p className="font-semibold">[Registry Connection Fault]</p>
            <p>{error}</p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadStudents()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="h-full w-full overflow-x-auto">
            <div className="min-w-max pr-4">
              {activeTab === "overview" && (
                <StudentOverviewTable data={filteredStudents} />
              )}

              {activeTab === "personal-info" && (
                <StudentPersonalInfoTable data={filteredStudents} />
              )}

              {activeTab === "financial-info" && (
                <StudentFinancialTable data={filteredStudents} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentsPage