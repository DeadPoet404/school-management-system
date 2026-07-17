"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { ModuleTabs } from "@/components/module-tabs"
import { UniversalSearch } from "@/components/universal-search"
import { ActionDropdown } from "@/components/action-dropdown"
import { Button } from "@/components/ui/button"
// ScrollArea import removed

// Sub-ledger Domain Specialized Component Tables
import { StaffOverviewTable } from "@/components/staff-overview-table"
import { StaffProfileTable } from "@/components/staff-profile-table"
import { StaffWorkforceTable } from "@/components/staff-workforce-table"
import { StaffPayrollTable } from "@/components/staff-payroll-table"

import { FileSpreadsheet, RefreshCw, Plus, UserMinus } from "lucide-react"

const staffTabs = [
  {
    value: "overview",
    label: "Overview",
    title: "Staff Overview",
    description: "Monitor staff employment statuses, roles, departmental distribution, and primary contacts.",
  },
  {
    value: "personal-info",
    label: "Personal Info",
    title: "Personal Information",
    description: "View and manage staff personal details, contact information, and demographic data.",
  },
  {
    value: "performance",
    label: "Performance",
    title: "Performance Ratings & Reviews",
    description: "Track performance ratings, service metrics, and evaluation periods.",
  },
  {
    value: "payroll",
    label: "Payroll",
    title: "Financial Accounts & Payroll",
    description: "Monitor base disbursements, track outstanding allowances, and manage salary balances.",
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
  account?: { fullName: string; email: string; role: string }
  demographics?: { phone: string; formerSchool: string }
  placement?: { departmentId: string; jobTitle: string; employmentType: string; shiftSchedule: string }
  compliance?: { nationalId: string }
  payroll?: { salaryStatus: string }
}

export default function StaffPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({})

  // Dynamic registry state tracking live database layers
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [isRegistrySyncing, setIsRegistrySyncing] = useState(true)

  // Dispatches network loop tracking database state rows on mount
  useEffect(() => {
    const liveRegistrySyncPipeline = async () => {
      try {
        setIsRegistrySyncing(true)
        const response = await fetch("${process.env.NEXT_PUBLIC_API_URL}/staff")

        if (!response.ok) {
          throw new Error(`HTTP network cluster error code: ${response.status}`)
        }

        const payload = await response.json()
        if (payload.success && Array.isArray(payload.data)) {
          setStaff(payload.data)
        }
      } catch (error) {
        console.error("[Telemetry Sync Fault]: Unable to pull live staff records:", error)
      } finally {
        setIsRegistrySyncing(false)
      }
    }

    liveRegistrySyncPipeline()
  }, [])

  // Centered filter matrix processor pipeline (watching state shifts)
  const filteredStaff = staff.filter((member) => {
    const name = member.account?.fullName || member.staffName || "Unknown Staff"
    const id = member.staffId || member.id || ""
    const dept = member.placement?.departmentId || member.department || ""
    const job = member.placement?.jobTitle || member.jobTitle || ""
    const empType = member.placement?.employmentType || member.employmentType || ""
    const email = member.account?.email || member.email || ""
    const currentStatus = member.status || "Active"

    const query = searchQuery.toLowerCase().trim()
    if (query) {
      const matchesSearch =
        name.toLowerCase().includes(query) ||
        id.toLowerCase().includes(query) ||
        dept.toLowerCase().includes(query) ||
        job.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query)

      if (!matchesSearch) return false
    }

    if (advancedFilters.employmentStatus && currentStatus !== advancedFilters.employmentStatus) {
      return false
    }
    if (advancedFilters.department && dept !== advancedFilters.department) {
      return false
    }
    if (advancedFilters.employmentType && empType !== advancedFilters.employmentType) {
      return false
    }
    if (advancedFilters.shiftSchedule && (member.placement?.shiftSchedule || member.shiftSchedule) !== advancedFilters.shiftSchedule) {
      return false
    }

    return true
  })

    return (
    <div className="w-full h-screen min-h-0 flex flex-col pt-6 px-6 pb-4 space-y-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-4xl tracking-tight text-foreground font-medium">
          Staff Management Infrastructure
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive administrative console for processing institutional human
          resources, workload distribution models, performance pipelines, and
          salaries.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-b border-zinc-100 dark:border-zinc-900 pb-3 w-full shrink-0">
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

        <div className="flex flex-wrap items-center gap-3 shrink-0">
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
              { label: "Upload CSV / XLSX", icon: FileSpreadsheet, onClick: () => {} },
              { label: "Sync Directory Server", icon: RefreshCw, onClick: () => {} },
            ]}
          />

          <Button
            variant="outline"
            onClick={() => {}}
            className="h-9 gap-1.5 px-3 text-xs font-medium tracking-wide border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 shadow-none transition-colors"
          >
            <UserMinus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Record Exit</span>
          </Button>

          <Button
            onClick={() => router.push("/staff/add")}
            className="h-9 gap-1.5 px-3 text-xs font-medium tracking-wide shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Staff Member</span>
          </Button>
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 overflow-y-auto rounded-md bg-background custom-scrollbar">
        {isRegistrySyncing ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-500 text-xs font-mono tracking-tight">
            Syncing live staff registry matrix from database infrastructure...
          </div>
        ) : (
          <div className="w-full h-full overflow-x-auto">
  <div className="min-w-max pr-4">
    {activeTab === "overview" && <StaffOverviewTable data={filteredStaff} />}
    {activeTab === "personal-info" && <StaffProfileTable data={filteredStaff} />}
    {activeTab === "performance" && <StaffWorkforceTable data={filteredStaff} />}
    {activeTab === "payroll" && <StaffPayrollTable data={filteredStaff} />}
  </div>
</div>
        )}
      </div>
    </div>
  )
}