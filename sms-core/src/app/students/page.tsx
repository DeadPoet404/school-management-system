"use client"

import { useAuth } from "@/lib/auth-context"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, LogOut, Plus, RefreshCw } from "lucide-react"

import { ModuleTabs } from "@/components/module-tabs"
import { UniversalSearch } from "@/components/universal-search"
import {
  StudentRegistryFilter,
  type StudentClassFilterOption,
} from "@/components/student-registry-filter"
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
type StudentFilters = Record<string, string>

type StudentListResponse = {
  success?: boolean
  data?: StudentRecord[]
  message?: string
  pagination?: {
    page?: number
    totalPages?: number
  }
}

type ClassReferenceResponse = {
  success?: boolean
  data?: Array<
    StudentClassFilterOption & {
      isActive?: boolean
    }
  >
}

const StudentsPage = () => {
  const { user } = useAuth()
  const canWrite = user?.role === "ADMIN" || user?.role === "STAFF"

  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const studentRequestRef = useRef(0)

  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [advancedFilters, setAdvancedFilters] = useState<StudentFilters>({})
  const [classOptions, setClassOptions] = useState<StudentClassFilterOption[]>([])

  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    let cancelled = false

    const loadClasses = async () => {
      try {
        const response = await fetchWithAuth(
          "/reference/classes"
        )

        if (!response.ok) return

        const result =
          (await response.json()) as ClassReferenceResponse

        if (
          !cancelled &&
          result.success &&
          Array.isArray(result.data)
        ) {
          setClassOptions(
            result.data.filter(
              (item) => item.isActive !== false
            )
          )
        }
      } catch {
        // The student list remains usable without class options.
      }
    }

    void loadClasses()

    return () => {
      cancelled = true
    }
  }, [])

  const loadStudents = useCallback(async () => {
    const requestId = ++studentRequestRef.current

    const requestPage = async (page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "100",
      })

      if (debouncedSearch) {
        params.set("search", debouncedSearch)
      }

      for (const [key, value] of Object.entries(
        advancedFilters
      )) {
        if (value) params.set(key, value)
      }

      const response = await fetchWithAuth(
        `/students?${params.toString()}`
      )

      const result =
        (await response
          .json()
          .catch(() => null)) as StudentListResponse | null

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            `Student search failed with HTTP ${response.status}.`
        )
      }

      if (!Array.isArray(result.data)) {
        throw new Error(
          "The students endpoint returned an unexpected data structure."
        )
      }

      return result
    }

    try {
      setLoading(true)
      setError(null)

      const firstPage = await requestPage(1)
      const totalPages = Math.min(
        100,
        Math.max(
          1,
          Number(firstPage.pagination?.totalPages) || 1
        )
      )

      const remainingPages = await Promise.all(
        Array.from(
          { length: totalPages - 1 },
          (_, index) => requestPage(index + 2)
        )
      )

      if (requestId !== studentRequestRef.current) {
        return
      }

      setStudents([
        ...(firstPage.data || []),
        ...remainingPages.flatMap(
          (page) => page.data || []
        ),
      ])
    } catch (caught) {
      if (requestId !== studentRequestRef.current) {
        return
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load students."
      )
    } finally {
      if (requestId === studentRequestRef.current) {
        setLoading(false)
      }
    }
  }, [advancedFilters, debouncedSearch])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  const handleImportClick = () => {
    if (importing) {
      return
    }

    fileInputRef.current?.click()
  }

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget
    const file = input.files?.[0]

    if (!file) {
      return
    }

    try {
      setImporting(true)

      const formData = new FormData()
      formData.append("file", file)

      const response = await fetchWithAuth("/students/import", {
        method: "POST",
        body: formData,
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message || `Student import failed with HTTP ${response.status}.`
        )
      }

      const summary = result?.data ?? {}
      const rowErrors = Array.isArray(summary.errors)
        ? summary.errors.slice(0, 5)
        : []

      const lines = [
        `Student import complete for "${file.name}".`,
        `Total rows: ${summary.totalRows ?? 0}`,
        `Created: ${summary.created ?? 0}`,
        `Failed: ${summary.failed ?? 0}`,
      ]

      if (rowErrors.length > 0) {
        lines.push("")
        lines.push("First row errors:")
        rowErrors.forEach((rowError: { row?: number; message?: string }) => {
          lines.push(`Row ${rowError.row ?? "?"}: ${rowError.message ?? "Unknown error"}`)
        })
      }

      window.alert(lines.join("\n"))
      await loadStudents()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Student import failed.")
    } finally {
      input.value = ""
      setImporting(false)
    }
  }

  const activeFilterCount = Object.values(
    advancedFilters
  ).filter(Boolean).length

  return (
    <div className="flex h-screen min-h-0 w-full flex-col space-y-3 overflow-hidden px-4 pt-4 pb-4 sm:space-y-4 sm:px-6 sm:pt-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileSelected}
        disabled={importing}
      />

      <div className="shrink-0">
        <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-4xl">
          Student Management System
        </h1>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
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

          <StudentRegistryFilter
            activeFilterCount={activeFilterCount}
            classes={classOptions}
            onApplyFilters={setAdvancedFilters}
          />

          {canWrite ? (
            <>
              <ActionDropdown
                label="Import"
                menuLabel="Import Options"
                items={[
                  {
                    label: importing ? "Importing..." : "Upload CSV / XLSX",
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
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadStudents()}
              className="h-9 gap-1.5 border-zinc-200 px-3 text-xs font-medium tracking-wide text-zinc-700 shadow-none transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
            >
              <RefreshCw className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Sync Student Data</span>
            </Button>
          )}
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
          <>
            {/* ── Desktop: wide data tables (unchanged) ── */}
            <div className="hidden h-full w-full overflow-x-auto lg:block">
              <div className="min-w-max pr-4">
                {activeTab === "overview" && (
                  <StudentOverviewTable data={students} />
                )}

                {activeTab === "personal-info" && (
                  <StudentPersonalInfoTable data={students} />
                )}

                {activeTab === "financial-info" && (
                  <StudentFinancialTable data={students} />
                )}
              </div>
            </div>

            {/* ── Mobile: card-first views ── */}
            <div className="h-full w-full overflow-y-auto overscroll-contain lg:hidden">
              {activeTab === "overview" && (
                <StudentOverviewTable data={students} />
              )}

              {(activeTab === "personal-info" ||
                activeTab === "financial-info") && (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {studentTabs.find((tab) => tab.value === activeTab)?.title}{" "}
                    is optimised for larger screens
                  </p>
                  <p className="max-w-72 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
                    {studentTabs.find((tab) => tab.value === activeTab)
                      ?.description ?? "Use a desktop view for this data."}{" "}
                    Switch to a tablet or desktop for the full record.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default StudentsPage
