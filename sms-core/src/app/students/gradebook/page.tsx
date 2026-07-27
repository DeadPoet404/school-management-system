"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Save, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { UniversalEditableGrid, DataGridColumn } from "@/components/universal-editable-grid"
import { useClasses, useSubjects, useTerms } from "@/lib/api/reference"

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
  classId?: string
  classScore: string
  examScore: string
  total?: string
  grade?: React.ReactNode
  remark?: string
}

type StudentApiRow = Record<string, unknown> & {
  id?: string
  studentId?: string
  studentName?: string
  account?: {
    fullName?: string
  }
  placement?: {
    classId?: string | null
  } | null
}

interface ReferenceDropdownOption {
  id: string
  label: string
  meta?: string
}

interface GradeScoreDraft {
  classScore: string
  examScore: string
}

interface ReferenceDropdownProps {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  options: ReferenceDropdownOption[]
  isLoading: boolean
  isError: boolean
  errorText: string
}

function ReferenceDropdown({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  options,
  isLoading,
  isError,
  errorText,
}: ReferenceDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return options
    }

    return options.filter((option) =>
      `${option.label} ${option.meta ?? ""} ${option.id}`.toLowerCase().includes(normalizedQuery)
    )
  }, [options, query])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  const disabled = isLoading || isError

  return (
    <div ref={rootRef} className="relative min-w-[180px] space-y-1">
      <Label htmlFor={id} className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
        {label}
      </Label>

      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current)
            setQuery("")
          }
        }}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-background px-3 text-left text-xs text-foreground shadow-none transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <span className={selectedOption ? "truncate" : "truncate text-muted-foreground"}>
          {isLoading ? "Loading..." : isError ? "Unable to load" : selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 dark:border-zinc-800">
          <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false)
                }
              }}
              placeholder={searchPlaceholder}
              className="h-8 text-xs"
            />
          </div>

          <div role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matches found.
              </div>
            ) : (
              filteredOptions.map((option) => {
                const selected = option.id === value

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onValueChange(option.id)
                      setOpen(false)
                      setQuery("")
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="flex h-4 w-4 items-center justify-center">
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.meta ? (
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {option.meta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}

      {isError ? (
        <p className="text-[10px] text-destructive">{errorText}</p>
      ) : null}
    </div>
  )
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

  const {
    data: classes = [],
    isLoading: isClassesLoading,
    isError: isClassesError,
  } = useClasses()

  const {
    data: subjects = [],
    isLoading: isSubjectsLoading,
    isError: isSubjectsError,
  } = useSubjects()

  const {
    data: terms = [],
    isLoading: isTermsLoading,
    isError: isTermsError,
  } = useTerms()

  const classOptions = useMemo<ReferenceDropdownOption[]>(
    () =>
      classes
        .filter((item) => item.isActive !== false)
        .map((item) => ({
          id: item.id,
          label: item.section ? `${item.name} (${item.section})` : item.name,
          meta: item.id,
        })),
    [classes]
  )

  const subjectOptions = useMemo<ReferenceDropdownOption[]>(
    () =>
      subjects
        .filter((item) => item.isActive !== false)
        .map((item) => ({
          id: item.id,
          label: item.code ? `${item.name} (${item.code})` : item.name,
          meta: item.id,
        })),
    [subjects]
  )

  const termOptions = useMemo<ReferenceDropdownOption[]>(
    () =>
      terms
        .filter((item) => item.isActive !== false)
        .map((item) => ({
          id: item.id,
          label: `${item.name} • ${item.academicYear}`,
          meta: item.id,
        })),
    [terms]
  )

  useEffect(() => {
    if (!subjectId && subjectOptions.length > 0) {
      setSubjectId(subjectOptions[0].id)
    }
  }, [subjectId, subjectOptions])

  function buildDraftKey(studentId: string) {
    return `${classId || "no-class"}:${subjectId || "no-subject"}:${termId || "no-term"}:${studentId}`
  }

  function applyActiveDraft(row: StudentGradeRow): StudentGradeRow {
    const draft = scoreDrafts[buildDraftKey(row.studentId)]

    if (!draft) {
      return {
        ...row,
        classScore: "",
        examScore: "",
      }
    }

    return {
      ...row,
      classScore: draft.classScore,
      examScore: draft.examScore,
    }
  }

  // Student records fetched from API
  const [records, setRecords] = useState<StudentGradeRow[]>([])

  // Draft scores are scoped per class + subject + term + student.
  // This preserves uncommitted Biology scores when switching to another subject
  // and then back to Biology.
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, GradeScoreDraft>>({})

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
        const students: StudentApiRow[] = payload.data || []

        setRecords(
          students.map((student) => ({
            studentId: student.id || "",
            studentName: student.studentName || student.account?.fullName || "Unknown",
            rollNumber: student.studentId || student.id || "",
            classId: student.placement?.classId || "",
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

    if (!classId || !subjectId || !termId) {
      toast.error("Select class, subject, and term before entering scores.")
      return
    }

    const maxThreshold = columnKey === "classScore" ? 30 : 70
    if (parseFloat(newValue) > maxThreshold) {
      toast.error(`Max ${columnKey === "classScore" ? "Class Mark" : "Exam Mark"} is ${maxThreshold}`)
      return
    }

    setScoreDrafts((prev) => {
      const key = buildDraftKey(rowId)
      const current = prev[key] ?? { classScore: "", examScore: "" }

      return {
        ...prev,
        [key]: {
          ...current,
          [columnKey]: newValue,
        },
      }
    })
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
      const rowWithDraft = applyActiveDraft(row)
      const metrics = getGradeMetrics(rowWithDraft.classScore, rowWithDraft.examScore)

      return {
        ...rowWithDraft,
        total: metrics.total,
        grade: <span className={metrics.style}>{metrics.grade}</span>,
        remark: metrics.remark,
      }
    })
  }, [classId, records, scoreDrafts, subjectId, termId])

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return computedRecords.filter((record) => {
      const matchesClass = !classId || record.classId === classId
      const matchesSearch =
        !query ||
        record.studentName.toLowerCase().includes(query) ||
        record.rollNumber.toLowerCase().includes(query)

      return matchesClass && matchesSearch
    })
  }, [classId, computedRecords, searchQuery])

  // --- REAL PERSISTENCE: POST each mark to /grades/submit ---
  const handleCommitGrades = async () => {
    if (!classId || !subjectId || !termId) {
      toast.error("Missing required fields", {
        description: "Select a class, subject, and term before committing grades.",
      })
      return
    }

    const selectedClassRecords = records
      .filter((record) => record.classId === classId)
      .map((record) => applyActiveDraft(record))

    if (selectedClassRecords.length === 0) {
      toast.error("No students in selected class", {
        description: "Choose a class with enrolled students before committing grades.",
      })
      return
    }

    const rowsWithScores = selectedClassRecords.filter((record) => record.classScore !== "" || record.examScore !== "")
    if (rowsWithScores.length === 0) {
      toast.error("No scores to submit", {
        description: "Enter at least one class or exam score for the selected class before committing.",
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
              subjectId,
              classId,
              termId,
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

      const succeeded = results.filter((result) => result.status === "fulfilled").length
      const failed = results.filter((result) => result.status === "rejected").length

      if (failed === 0) {
        toast.success(`All ${succeeded} grades committed successfully`)
      } else {
        toast.warning("Grades partially committed", {
          description: `${succeeded} succeeded, ${failed} failed. Check individual errors below.`,
        })
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            toast.error(`${rowsWithScores[index].studentName}: ${result.reason?.message || "Unknown error"}`)
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
            Enter scores below and commit to the database. Class, subject, and term are selected from live reference data.
          </p>
        </div>
      </div>

      {/* Required reference selectors + search */}
      <div className="shrink-0 flex flex-wrap items-end gap-4 w-full p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
        <ReferenceDropdown
          id="gradebook-class"
          label="Class"
          value={classId}
          onValueChange={setClassId}
          placeholder="Select class"
          searchPlaceholder="Search classes..."
          options={classOptions}
          isLoading={isClassesLoading}
          isError={isClassesError}
          errorText="Classes unavailable"
        />

        <ReferenceDropdown
          id="gradebook-subject"
          label="Subject"
          value={subjectId}
          onValueChange={setSubjectId}
          placeholder="Select subject"
          searchPlaceholder="Search subjects..."
          options={subjectOptions}
          isLoading={isSubjectsLoading}
          isError={isSubjectsError}
          errorText="Subjects unavailable"
        />

        <ReferenceDropdown
          id="gradebook-term"
          label="Term"
          value={termId}
          onValueChange={setTermId}
          placeholder="Select term"
          searchPlaceholder="Search terms..."
          options={termOptions}
          isLoading={isTermsLoading}
          isError={isTermsError}
          errorText="Terms unavailable"
        />

        <div className="ml-auto flex items-end">
          <Button
            disabled={isSubmitting}
            onClick={handleCommitGrades}
            className="h-8 gap-1.5 px-3 text-xs font-medium shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Commit Grades</span>
          </Button>
        </div>

        <div className="flex-1 min-w-[220px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by student name or ID..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
            emptyMessage={classId ? "No students found for the selected class." : "No students found."}
            onCellValueChange={handleCellValueChange}
          />
        )}
      </div>
    </main>
  )
}
