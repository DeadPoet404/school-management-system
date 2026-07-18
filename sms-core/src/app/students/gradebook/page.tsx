"use client"

import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { Save, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { UniversalEditableGrid, DataGridColumn } from "@/components/universal-editable-grid"

// --- INTERNAL GRADING LOGIC ENGINE ---
function getGradeMetrics(classStr: string, examStr: string) {
  const cScore = parseFloat(classStr) || 0
  const eScore = parseFloat(examStr) || 0
  const total = cScore + eScore

  let grade = "F"
  let remark = "Fail"
  let style = "text-rose-500 font-medium"

  if (total >= 80) { grade = "A1"; remark = "Excellent"; style = "text-emerald-600 dark:text-emerald-400 font-bold" }
  else if (total >= 70) { grade = "B2"; remark = "Very Good"; style = "text-emerald-500 dark:text-emerald-500 font-medium" }
  else if (total >= 65) { grade = "B3"; remark = "Good"; style = "text-amber-600 dark:text-amber-400" }
  else if (total >= 60) { grade = "C4"; remark = "Credit"; style = "text-amber-500" }
  else if (total >= 55) { grade = "C5"; remark = "Credit"; style = "text-zinc-700 dark:text-zinc-300" }
  else if (total >= 50) { grade = "C6"; remark = "Credit"; style = "text-zinc-600 dark:text-zinc-400" }
  else if (total >= 45) { grade = "D7"; remark = "Pass"; style = "text-zinc-500" }
  else if (total >= 40) { grade = "E8"; remark = "Pass"; style = "text-zinc-400" }

  return { total: total.toFixed(1), grade, remark, style }
}

interface StudentGradeRow {
  studentId: string
  studentName: string
  rollNumber: string
  classScore: string
  examScore: string
  total?: string
  grade?: React.ReactNode
  remark?: string
}

export default function GradeBookDashboard() {
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Required IDs for grade submission
  const [classId, setClassId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [termId, setTermId] = useState("")

  // Student records fetched from API
  const [records, setRecords] = useState<StudentGradeRow[]>([])

  // Fetch students from backend
  useEffect(() => {
    async function loadStudents() {
      try {
        setIsLoading(true)
        setFetchError(null)
        const response = await fetchWithAuth("/students?limit=500")

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json()
        const students: Array<Record<string, unknown>> = payload.data || []

        setRecords(
          students.map((s) => ({
            studentId: (s.id as string) || "",
            studentName: (s.studentName as string) || (s.account as Record<string, string>)?.fullName || "Unknown",
            rollNumber: (s.studentId as string) || (s.id as string),
            classScore: "",
            examScore: "",
          }))
        )
      } catch {
        setFetchError("Unable to load students. Check your connection and try again.")
      } finally {
        setIsLoading(false)
      }
    }
    loadStudents()
  }, [])

  // --- VALUE MUTATOR INTERCEPTOR ---
  const handleCellValueChange = (rowId: string, columnKey: string, newValue: string) => {
    if (newValue !== "" && newValue !== "." && isNaN(Number(newValue))) return

    const maxThreshold = columnKey === "classScore" ? 30 : 70
    if (parseFloat(newValue) > maxThreshold) {
      toast.error(`Max ${columnKey === "classScore" ? "Class Mark" : "Exam Mark"} is ${maxThreshold}`)
      return
    }

    setRecords((prev) =>
      prev.map((row) => (row.studentId === rowId ? { ...row, [columnKey]: newValue } : row))
    )
  }

  // --- DYNAMIC COLUMNS SETUP ---
  const gridColumns = useMemo<DataGridColumn<StudentGradeRow>[]>(() => [
    { key: "rollNumber", header: "Student ID", className: "w-36 font-mono text-zinc-500 text-[11px]" },
    { key: "studentName", header: "Student Name", className: "flex-1 text-left font-medium text-zinc-900 dark:text-zinc-100" },
    { key: "classScore", header: "Class (Max 30)", className: "w-44 bg-amber-50/10 dark:bg-amber-950/5 text-center font-semibold", editable: true, placeholder: "0.0" },
    { key: "examScore", header: "Exam (Max 70)", className: "w-44 bg-sky-50/10 dark:bg-sky-950/5 text-center font-semibold", editable: true, placeholder: "0.0" },
    {
      key: "total",
      header: "Total (100)",
      className: "w-28 text-center font-mono font-bold bg-zinc-50/50 dark:bg-zinc-900/40 text-foreground",
    },
    { key: "grade", header: "Grade", className: "w-24 text-center font-mono text-xs" },
    { key: "remark", header: "Remarks", className: "w-36 text-center text-muted-foreground text-[11px] truncate" },
  ], [])

  const computedRecords = useMemo(() => {
    return records.map((row) => {
      const metrics = getGradeMetrics(row.classScore, row.examScore)
      return {
        ...row,
        total: metrics.total,
        grade: <span className={metrics.style}>{metrics.grade}</span>,
        remark: metrics.remark,
      }
    })
  }, [records])

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return computedRecords
    return computedRecords.filter(
      (r) => r.studentName.toLowerCase().includes(query) || r.rollNumber.toLowerCase().includes(query)
    )
  }, [computedRecords, searchQuery])

  // --- REAL PERSISTENCE: POST each mark to /grades/submit ---
  const handleCommitGrades = async () => {
    if (!classId.trim() || !subjectId.trim() || !termId.trim()) {
      toast.error("Missing required fields", {
        description: "Class ID, Subject ID, and Term ID are required to commit grades.",
      })
      return
    }

    const rowsWithScores = records.filter((r) => r.classScore !== "" || r.examScore !== "")
    if (rowsWithScores.length === 0) {
      toast.error("No scores to submit", {
        description: "Enter at least one class or exam score before committing.",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const results = await Promise.allSettled(
        rowsWithScores.map((row) =>
          fetchWithAuth("/grades/submit", {
            method: "POST",
            body: JSON.stringify({
              studentId: row.studentId,
              subjectId: subjectId.trim(),
              classId: classId.trim(),
              termId: termId.trim(),
              continuousAssessment: parseFloat(row.classScore) || 0,
              examination: parseFloat(row.examScore) || 0,
            }),
          }).then(async (res) => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
            return data
          })
        )
      )

      const succeeded = results.filter((r) => r.status === "fulfilled").length
      const failed = results.filter((r) => r.status === "rejected").length

      if (failed === 0) {
        toast.success(`All ${succeeded} grades committed successfully`)
      } else {
        toast.warning(`Grades partially committed`, {
          description: `${succeeded} succeeded, ${failed} failed. Check individual errors below.`,
        })
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            toast.error(`${rowsWithScores[i].studentName}: ${(r as PromiseRejectedResult).reason?.message || "Unknown error"}`)
          }
        })
      }
    } catch {
      toast.error("Failed to connect to server.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="w-full flex-1 min-h-0 flex flex-col bg-transparent pt-6 px-6 pb-4 space-y-4 overflow-hidden">

      <div className="shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-4xl tracking-tight text-foreground font-medium">
            Continuous Assessment Sheet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter scores below and commit to the database. All fields are required for submission.
          </p>
        </div>
        <Button
          disabled={isSubmitting}
          onClick={handleCommitGrades}
          className="h-8 gap-1.5 px-3 text-xs font-medium shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
        >
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Commit Grades</span>
        </Button>
      </div>

      {/* Required ID inputs + search */}
      <div className="shrink-0 flex flex-wrap items-end gap-4 w-full p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <Label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Class ID</Label>
          <Input placeholder="e.g. cls-abc123" value={classId} onChange={(e) => setClassId(e.target.value)} className="h-8 text-xs w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Subject ID</Label>
          <Input placeholder="e.g. subj-math" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="h-8 text-xs w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Term ID</Label>
          <Input placeholder="e.g. term-1-2026" value={termId} onChange={(e) => setTermId(e.target.value)} className="h-8 text-xs w-40" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by student name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-400"
            />
          </div>
        </div>
      </div>

      {/* Grade grid */}
      <div className="w-full flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-zinc-400 text-xs">Loading students...</div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-sm text-destructive">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : (
          <UniversalEditableGrid
            data={filteredRecords}
            columns={gridColumns}
            rowId={(row) => row.studentId}
            selectable={true}
            emptyMessage="No students found."
            onCellValueChange={handleCellValueChange}
          />
        )}
      </div>
    </main>
  )
}
