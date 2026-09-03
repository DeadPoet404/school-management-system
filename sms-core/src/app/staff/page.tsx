"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, Plus, RefreshCw, UserMinus } from "lucide-react"

import { ModuleTabs } from "@/components/module-tabs"
import { UniversalSearch } from "@/components/universal-search"
import { ActionDropdown } from "@/components/action-dropdown"
import { Button } from "@/components/ui/button"

import { StaffOverviewTable } from "@/components/staff-overview-table"
import { StaffProfileTable } from "@/components/staff-profile-table"
import { StaffWorkforceTable } from "@/components/staff-workforce-table"
import { StaffPayrollTable } from "@/components/staff-payroll-table"

import { fetchWithAuth } from "@/lib/fetch-with-auth"

const staffTabs = [
  {
    value: "overview",
    label: "Overview",
    title: "Staff Overview",
    description:
      "Monitor staff employment statuses, roles, departmental distribution, and primary contacts.",
  },
  {
    value: "personal-info",
    label: "Personal Info",
    title: "Personal Information",
    description:
      "View and manage staff personal details, contact information, and demographic data.",
  },
  {
    value: "performance",
    label: "Performance",
    title: "Performance Ratings & Reviews",
    description:
      "Track performance ratings, service metrics, and evaluation periods.",
  },
  {
    value: "payroll",
    label: "Payroll",
    title: "Financial Accounts & Payroll",
    description:
      "Monitor base disbursements, track outstanding allowances, and manage salary balances.",
  },
]

type StaffRow = {
  id: string
  staffId?: string
  staffName?: string
  department?: string
  jobTitle?: string
  status?: string
  employmentType?: string
  shiftSchedule?: string
  yearsOfService?: number
  email?: string
  phone?: string
  salaryBalance?: number
  account?: {
    fullName?: string
    email?: string
    role?: string
  }
  demographics?: {
    phone?: string | null
    formerSchool?: string | null
    gender?: string | null
    dateOfBirth?: string | null
    residentialAddress?: string | null
  }
  placement?: {
    departmentId?: string
    jobTitle?: string
    employmentType?: string
    shiftSchedule?: string
  }
  compliance?: {
    nationalId?: string | null
  }
  payroll?: {
    salaryStatus?: string
    baseSalary?: number
    deductions?: number
    netPay?: number
  }
}

export default function StaffPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({})

  const [staff, setStaff] = useState<StaffRow[]>([])
  const [isRegistrySyncing, setIsRegistrySyncing] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const loadStaff = useCallback(async () => {
    try {
      setIsRegistrySyncing(true)
      setFetchError(null)

      const response = await fetchWithAuth("/staff?limit=500")

      if (!response.ok) {
        throw new Error(`HTTP network cluster error code: ${response.status}`)
      }

      const payload = await response.json()

      if (payload?.success && Array.isArray(payload.data)) {
        setStaff(payload.data)
        return
      }

      if (Array.isArray(payload?.data)) {
        setStaff(payload.data)
        return
      }

      if (Array.isArray(payload)) {
        setStaff(payload)
        return
      }

      throw new Error("The staff endpoint returned an unexpected data structure.")
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "Unable to load staff records. Please check your connection and try again."
      )
    } finally {
      setIsRegistrySyncing(false)
    }
  }, [])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const name = member.account?.fullName || member.staffName || "Unknown Staff"
      const id = member.staffId || member.id || ""
      const dept = member.placement?.departmentId || member.department || ""
      const job = member.placement?.jobTitle || member.jobTitle || ""
      const empType = member.placement?.employmentType || member.employmentType || ""
      const email = member.account?.email || member.email || ""
      const currentStatus = member.status || "ACTIVE"

      const query = searchQuery.toLowerCase().trim()

      if (query) {
        const matchesSearch =
          name.toLowerCase().includes(query) ||
          id.toLowerCase().includes(query) ||
          dept.toLowerCase().includes(query) ||
          job.toLowerCase().includes(query) ||
          email.toLowerCase().includes(query)

        if (!matchesSearch) {
          return false
        }
      }

      if (
        advancedFilters.employmentStatus &&
        currentStatus !== advancedFilters.employmentStatus
      ) {
        return false
      }

      if (advancedFilters.department && dept !== advancedFilters.department) {
        return false
      }

      if (
        advancedFilters.employmentType &&
        empType !== advancedFilters.employmentType
      ) {
        return false
      }

      if (
        advancedFilters.shiftSchedule &&
        (member.placement?.shiftSchedule || member.shiftSchedule) !==
          advancedFilters.shiftSchedule
      ) {
        return false
      }

      return true
    })
  }, [staff, searchQuery, advancedFilters])

  const handleUploadClick = () => {
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

      const response = await fetchWithAuth("/staff/import", {
        method: "POST",
        body: formData,
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message || `Staff import failed with HTTP ${response.status}.`
        )
      }

      const summary = result?.data ?? {}
      const rowErrors = Array.isArray(summary.errors)
        ? summary.errors.slice(0, 5)
        : []

      const lines = [
        `Staff import complete for "${file.name}".`,
        `Total rows: ${summary.totalRows ?? 0}`,
        `Created: ${summary.created ?? 0}`,
        `Failed: ${summary.failed ?? 0}`,
      ]

      if (rowErrors.length > 0) {
        lines.push("")
        lines.push("First row errors:")
        rowErrors.forEach((rowError: { row?: number; message?: string }) => {
          lines.push(
            `Row ${rowError.row ?? "?"}: ${
              rowError.message ?? "Unknown error"
            }`
          )
        })
      }

      window.alert(lines.join("\n"))
      await loadStaff()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Staff import failed.")
    } finally {
      input.value = ""
      setImporting(false)
    }
  }

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
          Staff Management Infrastructure
        </h1>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Comprehensive administrative console for processing institutional human
          resources, workload distribution models, performance pipelines, and
          salaries.
        </p>
      </div>

      <div className="flex w-full shrink-0 flex-col justify-between gap-4 border-b border-zinc-100 pt-4 pb-3 dark:border-zinc-900 lg:flex-row lg:items-center">
        <div className="mt-1 mb-[-8px]">
          <ModuleTabs
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab)
              setSearchQuery("")
              setAdvancedFilters({})
            }}
            tabs={staffTabs}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <UniversalSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search staff, IDs..."
            className="w-[200px]"
          />

          <ActionDropdown
            label="Import"
            menuLabel="Data Ingestion"
            items={[
              {
                label: importing ? "Importing..." : "Upload CSV / XLSX",
                icon: FileSpreadsheet,
                onClick: handleUploadClick,
              },
              {
                label: "Sync Staff Registry",
                icon: RefreshCw,
                onClick: () => void loadStaff(),
              },
            ]}
          />

          <Button
            variant="outline"
            onClick={() => router.push("/staff/departure")}
            className="h-9 gap-1.5 border-zinc-200 px-3 text-xs font-medium tracking-wide text-zinc-700 shadow-none transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
          >
            <UserMinus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Record Exit</span>
          </Button>

          <Button
            onClick={() => router.push("/staff/add")}
            className="h-9 gap-1.5 bg-zinc-900 px-3 text-xs font-medium tracking-wide text-zinc-50 shadow-none transition-colors hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Staff Member</span>
          </Button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 w-full flex-1 overflow-y-auto rounded-md bg-background">
        {isRegistrySyncing ? (
          <div className="flex h-48 items-center justify-center text-xs font-mono tracking-tight text-zinc-400 dark:text-zinc-500">
            Syncing live staff registry matrix from database infrastructure...
          </div>
        ) : fetchError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">{fetchError}</p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadStaff()}
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
                  <StaffOverviewTable data={filteredStaff} />
                )}

                {activeTab === "personal-info" && (
                  <StaffProfileTable data={filteredStaff} />
                )}

                {activeTab === "performance" && (
                  <StaffWorkforceTable data={filteredStaff} />
                )}

                {activeTab === "payroll" && (
                  <StaffPayrollTable data={filteredStaff} />
                )}
              </div>
            </div>

            {/* ── Mobile: card-first views (each table self-gates below lg) ── */}
            <div className="h-full w-full overflow-y-auto overscroll-contain lg:hidden">
              {activeTab === "overview" && (
                <StaffOverviewTable data={filteredStaff} />
              )}

              {activeTab === "personal-info" && (
                <StaffProfileTable data={filteredStaff} />
              )}

              {activeTab === "performance" && (
                <StaffWorkforceTable data={filteredStaff} />
              )}

              {activeTab === "payroll" && (
                <StaffPayrollTable data={filteredStaff} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
