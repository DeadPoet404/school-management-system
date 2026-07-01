"use client"

import { useState, useEffect } from "react"

import { ModuleTabs } from "@/components/module-tabs"
import { UniversalSearch } from "@/components/universal-search"
import { TeacherRegistryFilter } from "@/components/teacher-registry-filter"
import { ActionDropdown } from "@/components/action-dropdown"
import { Button } from "@/components/ui/button"

// Sub-ledger Domain Specialized Component Tables
import { TeacherOverviewTable } from "@/components/teacher-overview-table"
import { TeacherProfileTable } from "@/components/teacher-profile-table"
import { TeacherQualificationsTable } from "@/components/teacher-qualifications-table"
import { FacultyLoadTable } from "@/components/faculty-load-table"
import { FacultyPayrollTable } from "@/components/faculty-payroll-table"

import { FileSpreadsheet, RefreshCw, Plus, UserMinus } from "lucide-react"

const teacherTabs = [
  {
    value: "overview",
    label: "Overview",  
    title: "Teacher Overview",
    description: "View teacher employment status, department assignment, contact information, and active standing.",
  },
  {
    value: "personal-info",
    label: "Personal Info",
    title: "Personal Information",
    description: "View and manage teacher personal details, contact information, and demographic data.",
  },
  {
    value: "assignments",
    label: "Assignments",
    title: "Class & Subject Assignments",
    description: "Manage teaching schedules, assigned classes, and subject allocations.",
  },
  {
    value: "compensation",
    label: "Compensation",
    title: "Teacher Compensation Records",
    description: "Monitor salary bands, pay history, deductions, and benefits enrollment.",
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
  account?: { fullName: string; email: string; role: string }
  placement?: { departmentId: string; jobTitle: string; employmentType: string }
}

export default function TeachersPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({})
  
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [isRegistrySyncing, setIsRegistrySyncing] = useState(true)

  useEffect(() => {
    const liveRegistrySyncPipeline = async () => {
      try {
        setIsRegistrySyncing(true)
        const response = await fetch("http://localhost:5000/api/teachers")
        
        if (!response.ok) {
          throw new Error(`HTTP network cluster error code: ${response.status}`)
        }
        
        const payload = await response.json()
        if (payload.success && Array.isArray(payload.data)) {
          setTeachers(payload.data)
        }
      } catch (error) {
        console.error("[Telemetry Sync Fault]: Unable to pull live database records:", error)
      } finally {
        setIsRegistrySyncing(false)
      }
    }

    liveRegistrySyncPipeline()
  }, [])

  const filteredTeachers = teachers.filter((teacher) => {
    const name = teacher.account?.fullName || teacher.teacherName || "Unknown Faculty"
    const id = teacher.teacherId || teacher.id || ""
    const dept = teacher.placement?.departmentId || teacher.department || ""
    const job = teacher.placement?.jobTitle || teacher.subject || ""
    const empType = teacher.placement?.employmentType || teacher.employmentType || ""
    const email = teacher.account?.email || teacher.email || ""
    const currentStatus = teacher.status || "Active"

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
    if (advancedFilters.qualification && teacher.qualification !== advancedFilters.qualification) {
      return false
    }
    if (advancedFilters.minExperience && (teacher.yearsOfExperience ?? 0) < parseFloat(advancedFilters.minExperience)) {
      return false
    }
    if (advancedFilters.licenseStatus && teacher.licenseStatus !== advancedFilters.licenseStatus) {
      return false
    }

    return true
  })

  return (
    <div className="w-full h-screen min-h-0 flex flex-col pt-6 px-6 pb-4 space-y-4 overflow-hidden">
      
      {/* Structural Top Banner Segment */}
      <div className="shrink-0">
        <h1 className="text-4xl tracking-tight text-foreground font-medium">
          Teacher Management System
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive teacher management system for tracking employment status, qualifications, class assignments, and compensation records.
        </p>
      </div>

      {/* Control Layout Toolbar Frame */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-b border-zinc-100 dark:border-zinc-900 pb-3 w-full shrink-0">
        <div className="mt-1 mb-[-8px]">
          <ModuleTabs
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab)
              setSearchQuery("")
              setAdvancedFilters({})
            }}
            tabs={teacherTabs}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
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
              { label: "Upload CSV / XLSX", icon: FileSpreadsheet, onClick: () => {} },
              { label: "Sync HR Data", icon: RefreshCw, onClick: () => {} },
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
            onClick={() => {}}
            className="h-9 gap-1.5 px-3 text-xs font-medium tracking-wide shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Teacher</span>
          </Button>
        </div>
      </div>

      {/* Dynamic Render Pipeline Window */}
      <div className="w-full flex-1 min-h-0 overflow-y-auto rounded-md bg-background custom-scrollbar">
        {isRegistrySyncing ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-500 text-xs font-mono tracking-tight">
            Syncing live faculty registry matrix from database infrastructure...
          </div>
        ) : (
          <div className="w-full h-full overflow-x-auto">
            <div className="min-w-max pr-4">
              {activeTab === "overview" && <TeacherOverviewTable data={filteredTeachers} />}
              {activeTab === "personal-info" && <TeacherProfileTable data={filteredTeachers} />}
              {activeTab === "assignments" && <FacultyLoadTable data={filteredTeachers} />}
              {activeTab === "compensation" && <FacultyPayrollTable data={filteredTeachers} />}
            </div>
          </div>
        )}
      </div>
      
    </div>
  )
}