"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import { Save, ShieldCheck, Loader2, Check, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UniversalSearch } from "@/components/universal-search"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"

interface StudentAttendanceRecord {
  id: string
  indexNumber: string
  fullName: string
  status: AttendanceStatus
}

export type AttendanceRowModel = {
  id: string
  indexNumber: string
  fullName: string
  status: AttendanceStatus
}

const INITIAL_STUDENT_DATA: StudentAttendanceRecord[] = [
  { id: "1", indexNumber: "UCC-2024-0481", fullName: "Emmanuel Hagan", status: "PRESENT" },
  { id: "2", indexNumber: "UCC-2024-1102", fullName: "Abigail Mensah", status: "PRESENT" },
  { id: "3", indexNumber: "UCC-2024-0891", fullName: "Kofi Ansah Boateng", status: "ABSENT" },
  { id: "4", indexNumber: "UCC-2024-1340", fullName: "Priscilla Osei", status: "PRESENT" },
  { id: "5", indexNumber: "UCC-2024-0312", fullName: "Kwame Asante Opoku", status: "LATE" },
  { id: "6", indexNumber: "UCC-2024-1905", fullName: "Blessing Arthur", status: "PRESENT" },
  { id: "7", indexNumber: "UCC-2024-0221", fullName: "Selorm Degraft-Johnson", status: "EXCUSED" },
]

export default function DesktopAttendancePage() {
  const [students, setStudents] = useState<StudentAttendanceRecord[]>(INITIAL_STUDENT_DATA)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Real-time metrics dashboard
  const metrics = useMemo(() => {
    return {
      total: students.length,
      present: students.filter((s) => s.status === "PRESENT").length,
      absent: students.filter((s) => s.status === "ABSENT").length,
      late: students.filter((s) => s.status === "LATE").length,
      excused: students.filter((s) => s.status === "EXCUSED").length,
    }
  }, [students])

  const handleStatusUpdate = useCallback((id: string, targetStatus: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: targetStatus } : s))
    )
  }, [])

  const handleBulkStatusUpdate = useCallback((targetStatus: AttendanceStatus) => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: targetStatus })))
    toast.success(`All roster records updated to ${targetStatus.toLowerCase()}`)
  }, [])

  // Text search parsing pipeline
  const filteredData = useMemo<AttendanceRowModel[]>(() => {
    const query = searchQuery.toLowerCase().trim()
    return students.filter((student) => {
      if (!query) return true
      return (
        student.fullName.toLowerCase().includes(query) ||
        student.indexNumber.toLowerCase().includes(query)
      )
    })
  }, [students, searchQuery])

  // Dynamic Checkbox Column Renderer helper
  const createStatusColumn = (statusType: AttendanceStatus, activeStyles: string): DataTableColumn<AttendanceRowModel> => ({
    key: statusType.toLowerCase(),
    header: statusType.charAt(0) + statusType.slice(1).toLowerCase(),
    className: "w-[95px] text-center border-r border-zinc-200 dark:border-zinc-800",
    cell: (row) => {
      const isSelected = row.status === statusType
      return (
        <div className="flex items-center justify-center h-full">
          <button
            type="button"
            onClick={() => handleStatusUpdate(row.id, statusType)}
            className={cn(
              "h-5 w-5 rounded border transition-all flex items-center justify-center focus:outline-none",
              isSelected 
                ? activeStyles 
                : "border-zinc-300 dark:border-zinc-700 bg-background hover:bg-zinc-50 dark:hover:bg-zinc-900"
            )}
          >
            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
          </button>
        </div>
      )
    }
  })

  // Concrete column definitions targeting the 4 status grids + live badge column
  const columns = useMemo<DataTableColumn<AttendanceRowModel>[]>(() => [
    {
      key: "indexNumber",
      header: "Index Number",
      className: "w-[150px] border-r border-zinc-200 dark:border-zinc-800",
      cellClassName: "font-mono text-xs text-muted-foreground tracking-wider align-middle",
    },
    {
      key: "fullName",
      header: "Student Full Name",
      className: "min-w-[200px] border-r border-zinc-200 dark:border-zinc-800",
      cellClassName: "font-medium text-zinc-900 dark:text-zinc-100 text-sm align-middle",
    },
    {
      key: "status",
      header: "Current State",
      className: "w-[120px] text-center border-r border-zinc-200 dark:border-zinc-800",
      cell: (row) => (
        <span className={cn(
          "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono font-bold tracking-tight uppercase border align-middle",
          row.status === "PRESENT" && "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
          row.status === "ABSENT" && "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30",
          row.status === "LATE" && "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
          row.status === "EXCUSED" && "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
        )}>
          {row.status}
        </span>
      ),
    },
    createStatusColumn("PRESENT", "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100 shadow-sm"),
    createStatusColumn("ABSENT", "bg-rose-600 text-white border-rose-600 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30"),
    createStatusColumn("LATE", "bg-amber-500 text-white border-amber-500 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"),
    createStatusColumn("EXCUSED", "bg-zinc-500 text-white border-zinc-500 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"),
  ], [handleStatusUpdate])

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      await new Promise((resolve) => setTimeout(resolve, 800))
      toast.success("Attendance ledger synchronized", {
        description: "Status column matrices successfully committed to backend engines.",
      })
    } catch (error) {
      toast.error("Transmission connection failure.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full h-screen min-h-0 flex flex-col pt-6 px-6 pb-4 space-y-4 overflow-hidden">
      
      {/* ─── TITLE HUD HEADER ─── */}
      <div className="shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-4xl tracking-tight text-foreground font-medium">
            Daily Attendance Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            BSc. Computer Science — Session Checkpoint Management Grid.
          </p>
        </div>
        <div className="h-8 px-3 flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-xs font-mono font-bold text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" /> STATUS: OPERATIONAL
        </div>
      </div>

      {/* ─── UNIFIED SYSTEM TOOLBAR CONTROLS ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-b border-zinc-100 dark:border-zinc-900 pb-3 w-full shrink-0">
        
        {/* Left Segment: Search Input Framework */}
        <div className="flex items-center gap-3">
          <UniversalSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search students, index IDs..."
            className="w-[260px]"
          />
        </div>

        {/* Right Segment: Master Mass Status Set Toggles */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pr-1">Global Set:</span>

          <Button
            variant="outline"
            onClick={() => handleBulkStatusUpdate("PRESENT")}
            className="h-8 text-xs font-medium border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 shadow-none"
          >
            All Present
          </Button>

          <Button
            variant="outline"
            onClick={() => handleBulkStatusUpdate("ABSENT")}
            className="h-8 text-xs font-medium border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 shadow-none"
          >
            All Absent
          </Button>

          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 self-center mx-1" />

          <Button 
            disabled={isSubmitting}
            onClick={handleSubmit} 
            className="h-8 gap-1.5 px-3 text-xs font-medium shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 stroke-[2]" />}
            <span>Commit Registry</span>
          </Button>
        </div>
      </div>

      {/* ─── GRID CONTAINER AUTO-SCROLL VIEWPORT ─── */}
      <div className="w-full flex-1 min-h-0 overflow-hidden rounded-md bg-background custom-scrollbar [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div]:space-y-0 [&>div>div]:flex-1 [&>div>div]:min-h-0 [&>div>div]:overflow-y-auto [&>div>div]:rounded-md [&>div>div]:border-zinc-200 [&>div>div]:dark:border-zinc-800">
        <UniversalDataTable
          data={filteredData}
          columns={columns}
          rowId={(record) => record.id}
          selectable={false}
          emptyMessage="No matching student roster paths encountered inside this framework query."
        />
      </div>

      {/* ─── LIVE METRICS COUNTER FOOTER LEDGER ─── */}
      <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 pt-3 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <ClipboardList className="h-3.5 w-3.5 text-zinc-400" />
          <span>Active Registry Framework Volume: {filteredData.length} of {metrics.total} students metrics sorted.</span>
        </div>
        <div className="flex gap-4 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
          <div>Present: <span className="text-zinc-900 dark:text-zinc-100 font-bold">{metrics.present}</span></div>
          <div>Absent: <span className="text-zinc-900 dark:text-zinc-100 font-bold">{metrics.absent}</span></div>
          <div>Late: <span className="text-zinc-900 dark:text-zinc-100 font-bold">{metrics.late}</span></div>
          <div>Excused: <span className="text-zinc-900 dark:text-zinc-100 font-bold">{metrics.excused}</span></div>
        </div>
      </div>

    </div>
  )
}