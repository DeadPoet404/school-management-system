"use client"

import * as React from "react"
import { useState, useMemo, useCallback, useEffect } from "react"
import { Save, Loader2, Check, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UniversalSearch } from "@/components/universal-search"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

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

export default function DesktopAttendancePage() {
  const [students, setStudents] = useState<StudentAttendanceRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [classId, setClassId] = useState("")

  // Fetch students from API
  useEffect(() => {
    async function loadStudents() {
      try {
        setIsLoading(true)
        setFetchError(null)
        const response = await fetchWithAuth("/students?limit=500")
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        const data: Array<Record<string, unknown>> = payload.data || []
        setStudents(
          data.map((s) => ({
            id: (s.id as string) || "",
            indexNumber: (s.studentId as string) || (s.id as string),
            fullName: (s.studentName as string) || (s.account as Record<string, string>)?.fullName || "Unknown",
            status: "PRESENT" as AttendanceStatus,
          }))
        )
      } catch {
        setFetchError("Unable to load students.")
      } finally {
        setIsLoading(false)
      }
    }
    loadStudents()
  }, [])

  const metrics = useMemo(() => ({
    total: students.length,
    present: students.filter((s) => s.status === "PRESENT").length,
    absent: students.filter((s) => s.status === "ABSENT").length,
    late: students.filter((s) => s.status === "LATE").length,
    excused: students.filter((s) => s.status === "EXCUSED").length,
  }), [students])

  const handleStatusUpdate = useCallback((id: string, targetStatus: AttendanceStatus) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: targetStatus } : s)))
  }, [])

  const handleBulkStatusUpdate = useCallback((targetStatus: AttendanceStatus) => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: targetStatus })))
    toast.success(`All records set to ${targetStatus.toLowerCase()}`)
  }, [])

  const filteredData = useMemo<AttendanceRowModel[]>(() => {
    const query = searchQuery.toLowerCase().trim()
    return students.filter((student) => {
      if (!query) return true
      return student.fullName.toLowerCase().includes(query) || student.indexNumber.toLowerCase().includes(query)
    })
  }, [students, searchQuery])

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
              isSelected ? activeStyles : "border-zinc-300 dark:border-zinc-700 bg-background hover:bg-zinc-50 dark:hover:bg-zinc-900"
            )}
          >
            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
          </button>
        </div>
      )
    },
  })

  const columns = useMemo<DataTableColumn<AttendanceRowModel>[]>(() => [
    {
      key: "indexNumber",
      header: "Index Number",
      className: "w-[150px] border-r border-zinc-200 dark:border-zinc-800",
      cellClassName: "font-mono text-xs text-muted-foreground tracking-wider align-middle",
    },
    {
      key: "fullName",
      header: "Student Name",
      className: "min-w-[200px] border-r border-zinc-200 dark:border-zinc-800",
      cellClassName: "font-medium text-zinc-900 dark:text-zinc-100 text-sm align-middle",
    },
    {
      key: "status",
      header: "Status",
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

  // --- REAL PERSISTENCE: POST all records to /attendance/section ---
  const handleSubmit = async () => {
    if (!classId.trim()) {
      toast.error("Class ID is required to submit attendance.")
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetchWithAuth("/attendance/section", {
        method: "POST",
        body: JSON.stringify({
          date,
          classId: classId.trim(),
          records: students.map((s) => ({ studentId: s.id, status: s.status })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }

      toast.success("Attendance submitted successfully", {
        description: `${students.length} records committed for ${date}.`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit attendance.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full h-screen min-h-0 flex flex-col pt-6 px-6 pb-4 space-y-4 overflow-hidden">
      <div className="shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-4xl tracking-tight text-foreground font-medium">Daily Attendance Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Mark attendance and submit to the database.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-4 border-b border-zinc-100 dark:border-zinc-900 pb-3 w-full shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Class ID</Label>
            <Input placeholder="e.g. cls-abc123" value={classId} onChange={(e) => setClassId(e.target.value)} className="h-8 text-xs w-40" />
          </div>
          <UniversalSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search students..." className="w-[200px]" />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => handleBulkStatusUpdate("PRESENT")} className="h-8 text-xs font-medium border-zinc-200 dark:border-zinc-800 shadow-none">All Present</Button>
          <Button variant="outline" onClick={() => handleBulkStatusUpdate("ABSENT")} className="h-8 text-xs font-medium border-zinc-200 dark:border-zinc-800 shadow-none">All Absent</Button>
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 self-center mx-1" />
          <Button disabled={isSubmitting} onClick={handleSubmit} className="h-8 gap-1.5 px-3 text-xs font-medium shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors">
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 stroke-[2]" />}
            <span>Submit Attendance</span>
          </Button>
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 overflow-hidden rounded-md bg-background custom-scrollbar [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div]:space-y-0 [&>div>div]:flex-1 [&>div>div]:min-h-0 [&>div>div]:overflow-y-auto [&>div>div]:rounded-md [&>div>div]:border-zinc-200 [&>div>div]:dark:border-zinc-800">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 text-xs">Loading students...</div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-sm text-destructive">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : (
          <UniversalDataTable
            data={filteredData}
            columns={columns}
            rowId={(record) => record.id}
            selectable={false}
            emptyMessage="No students found."
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 pt-3 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <ClipboardList className="h-3.5 w-3.5 text-zinc-400" />
          <span>{filteredData.length} of {metrics.total} students</span>
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
