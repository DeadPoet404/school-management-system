"use client"

import { useState, useEffect, useMemo } from "react"

import { ModuleTabs } from "@/components/module-tabs"
import { UniversalSearch } from "@/components/universal-search"
import { StudentRegistryFilter } from "@/components/student-registry-filter"
import { ActionDropdown } from "@/components/action-dropdown"
import { Button } from "@/components/ui/button"

// Sub-ledger Domain Specialized Component Tables
import { StudentOverviewTable } from "@/components/student-overview-table"
import { StudentPersonalInfoTable } from "@/components/student-personal-info-table"
import { StudentFeeInfoTable } from "@/components/student-fees-info-table"
import { FileSpreadsheet, RefreshCw, Plus, LogOut } from "lucide-react" 
import { StudentFinancialTable } from "@/components/student-financial-table"
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const studentTabs = [
  {
    value: "overview",
    label: "Overview",
    title: "Student Overview",
    description: "View student academic performance, enrollment status, guardian contact information, and financial standing.",
  },
  {
    value: "personal-info",
    label: "Personal Info",
    title: "Personal Information",
    description: "View and manage student personal details and contact information.",
  },
  {
    value: "financial-info", // ── CHANGED FROM fees-info TO MATCH YOUR TABLE RENDERER VALUE
    label: "Fees Info",
    title: "Fee Information",
    description: "View and manage student fee records and payment history.",
  },
]
const StudentsPage = () => {
  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({})
  
  // ⚡ REAL LIVE STATE MATRIX
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // ⚡ FETCH REAL LIVE RECORDS ONCE FOR ALL CORES
  useEffect(() => {
    const fetchLiveDatabaseRegistry = async () => {
      try {
        setLoading(true)
        const response = await fetchWithAuth("/students")
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`)
        }
        const json = await response.json()
        
        if (json && json.success && Array.isArray(json.data)) {
          setStudents(json.data)
        } else if (Array.isArray(json)) {
          setStudents(json)
        } else if (json && Array.isArray(json.data)) {
          setStudents(json.data)
        } else {
          throw new Error("Invalid structure format returned from database endpoint")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchLiveDatabaseRegistry()
  }, [])

  // Centered filter matrix processor pipeline (Handles text matching & dynamic filters)
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 1. Core Text Search Match Engine
      const query = searchQuery.toLowerCase().trim()
      if (query) {
        const rawName = student.studentName || student.name || student.account?.fullName || ""
        const rawId = student.studentId || student.id || ""
        const rawClass = student.placement?.classId || student.class || ""
        const rawGuardian = student.guardian?.name || ""

        const matchesSearch =
          rawName.toLowerCase().includes(query) ||
          rawId.toLowerCase().includes(query) ||
          rawClass.toLowerCase().includes(query) ||
          rawGuardian.toLowerCase().includes(query)
        
        if (!matchesSearch) return false
      }

      // 2. Advanced Popover Evaluation Engine (Wired directly into Prisma Relation Schema Objects)
      if (advancedFilters.academicStanding && student.status !== advancedFilters.academicStanding) {
        return false
      }
      if (advancedFilters.gradeLevel && student.placement?.classId !== advancedFilters.gradeLevel) {
        return false
      }
      if (advancedFilters.major && student.placement?.academicTrack !== advancedFilters.major) {
        return false
      }
      if (advancedFilters.minGpa && (student.currentGpa ?? 0) < parseFloat(advancedFilters.minGpa)) {
        return false
      }
      if (advancedFilters.minAttendance && (student.attendanceRate ?? 0) < parseFloat(advancedFilters.minAttendance)) {
        return false
      }

      return true
    })
  }, [students, searchQuery, advancedFilters])

  return (
    <div className="w-full h-screen min-h-0 flex flex-col pt-6 px-6 pb-4 space-y-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-4xl tracking-tight text-foreground font-medium">
          Student Management System
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive student management system for tracking academic
          performance, enrollment status, guardian relationships, and financial standing.
        </p>
      </div>

      {/* Unified Control Layout Frame */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-b border-zinc-100 dark:border-zinc-900 pb-3 w-full shrink-0">
        {/* Left Segment: Module Selector Segment */}
        <div className="mt-1 mb-[-8px]">
          <ModuleTabs
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab)
              setSearchQuery("") // Clear text criteria when switching contexts
              setAdvancedFilters({}) // Wipe telemetry criteria when shifting viewports
            }}
            tabs={studentTabs}
          />
        </div>

        {/* Right Segment: Search & Layout Level Tools Combined */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
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
              { label: "Upload CSV / XLSX", icon: FileSpreadsheet, onClick: () => {} },
              { label: "Sync Student Data", icon: RefreshCw, onClick: () => {} },
            ]}
          />

          <Button
            variant="outline"
            onClick={() => {}}
            className="h-9 gap-1.5 px-3 text-xs font-medium tracking-wide border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 shadow-none transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Record Departure</span>
          </Button>

          <Button 
            onClick={() => {}} 
            className="h-9 gap-1.5 px-3 text-xs font-medium tracking-wide shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Student</span>
          </Button>
        </div>
      </div>

      {/* Dynamic Render Pipeline Window */}
      <div className="w-full flex-1 min-h-0 overflow-y-auto rounded-md bg-background custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 dark:text-zinc-500 text-xs font-mono tracking-tight animate-pulse">
            Syncing database connection matrix across active sub-ledgers...
          </div>
        ) : error ? (
          <div className="flex m-4 flex-col items-center justify-center gap-2 rounded-lg border border-red-200/40 bg-red-50/20 p-4 text-xs font-mono text-red-600 dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-400">
            <p className="font-semibold">[Core Connection Fault]</p>
            <p>{error}</p>
          </div>
        ) : (
          <div className="w-full h-full overflow-x-auto">
            <div className="min-w-max pr-4">
              {activeTab === "overview" && <StudentOverviewTable data={filteredStudents} />}
              {activeTab === "personal-info" && <StudentPersonalInfoTable data={filteredStudents} />}
              {activeTab === "fees-info" && <StudentFeeInfoTable data={filteredStudents} />}
              {activeTab === "financial-info" && <StudentFinancialTable data={filteredStudents} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentsPage 