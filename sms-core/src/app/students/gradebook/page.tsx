"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Save, Loader2, Search, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

// Import our new editable grid and custom combobox primitives
import { UniversalEditableGrid, DataGridColumn } from "@/components/universal-editable-grid"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

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

// --- DATA REGISTRY SEED ARRAYS ---
const ACADEMIC_CLASSES = [
  "Pre-School", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "JHS 1", "JHS 2", "JHS 3"
] as const

const CURRICULUM_SUBJECTS = [
  "Mathematics",
  "Integrated Science",
  "English Language",
  "Social Studies",
  "Computing"
] as const

interface StudentGradeRow {
  studentId: string
  studentName: string
  rollNumber: string
  classScore: string
  examScore: string
  // Computed parameters mapped via closures in row definitions
  total?: string
  grade?: string
  remark?: string
}

export default function GradeBookDashboard() {
  // Controlled Selection Hooks
  const [selectedClass, setSelectedClass] = useState<string>("Grade 1")
  const [selectedSubject, setSelectedSubject] = useState<string>("Mathematics")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Seeding 30 Local Student records inside managed state environment
  const [records, setRecords] = useState<StudentGradeRow[]>([
    { studentId: "st-01", studentName: "Emmanuel Hagan", rollNumber: "UCC-2026-0481", classScore: "26.5", examScore: "61.0" },
    { studentId: "st-02", studentName: "Abigail Mensah", rollNumber: "UCC-2026-1102", classScore: "28.0", examScore: "65.5" },
    { studentId: "st-03", studentName: "Kofi Ansah Boateng", rollNumber: "UCC-2026-0891", classScore: "18.0", examScore: "42.0" },
    { studentId: "st-04", studentName: "Priscilla Osei", rollNumber: "UCC-2026-1340", classScore: "24.0", examScore: "54.0" },
    { studentId: "st-05", studentName: "Kwame Asante Opoku", rollNumber: "UCC-2026-0312", classScore: "21.5", examScore: "48.0" },
    { studentId: "st-06", studentName: "Blessing Arthur", rollNumber: "UCC-2026-1905", classScore: "29.0", examScore: "68.0" },
    { studentId: "st-07", studentName: "Michael Tetteh", rollNumber: "UCC-2026-0774", classScore: "14.5", examScore: "35.0" },
    { studentId: "st-08", studentName: "Eunice Baah", rollNumber: "UCC-2026-2109", classScore: "27.0", examScore: "59.0" },
    { studentId: "st-09", studentName: "Prince Owusu Sekyere", rollNumber: "UCC-2026-1443", classScore: "23.0", examScore: "51.5" },
    { studentId: "st-10", studentName: "Dorcas Amoah", rollNumber: "UCC-2026-0921", classScore: "25.5", examScore: "56.0" },
    { studentId: "st-11", studentName: "Samuel Kwakye", rollNumber: "UCC-2026-1882", classScore: "19.0", examScore: "44.5" },
    { studentId: "st-12", studentName: "Lydia Forson", rollNumber: "UCC-2026-0567", classScore: "22.0", examScore: "49.0" },
    { studentId: "st-13", studentName: "Francis Gyamfi", rollNumber: "UCC-2026-1011", classScore: "16.0", examScore: "38.0" },
    { studentId: "st-14", studentName: "Grace Appiah", rollNumber: "UCC-2026-2241", classScore: "28.5", examScore: "63.0" },
    { studentId: "st-15", studentName: "Joseph Agyemang", rollNumber: "UCC-2026-0255", classScore: "20.5", examScore: "47.0" },
    { studentId: "st-16", studentName: "Mary Afriyie", rollNumber: "UCC-2026-1190", classScore: "24.5", examScore: "55.5" },
    { studentId: "st-17", studentName: "Daniel Ofori Atta", rollNumber: "UCC-2026-0612", classScore: "26.0", examScore: "58.0" },
    { studentId: "st-18", studentName: "Sarah Nyarko", rollNumber: "UCC-2026-1734", classScore: "17.5", examScore: "41.0" },
    { studentId: "st-19", studentName: "Charles Edusei", rollNumber: "UCC-2026-0803", classScore: "23.5", examScore: "52.0" },
    { studentId: "st-20", studentName: "Rebecca Addo", rollNumber: "UCC-2026-2001", classScore: "29.5", examScore: "69.5" },
    { studentId: "st-21", studentName: "Isaac Quaye", rollNumber: "UCC-2026-0442", classScore: "15.0", examScore: "39.5" },
    { studentId: "st-22", studentName: "Cynthia Badu", rollNumber: "UCC-2026-1559", classScore: "21.0", examScore: "46.0" },
    { studentId: "st-23", studentName: "Derrick Mensah", rollNumber: "UCC-2026-0998", classScore: "25.0", examScore: "53.0" },
    { studentId: "st-24", studentName: "Esther Antwi", rollNumber: "UCC-2026-1215", classScore: "27.5", examScore: "62.5" },
    { studentId: "st-25", studentName: "Stephen Yeboah", rollNumber: "UCC-2026-0377", classScore: "18.5", examScore: "43.0" },
    { studentId: "st-26", studentName: "Rachel Ankomah", rollNumber: "UCC-2026-1662", classScore: "22.5", examScore: "50.0" },
    { studentId: "st-27", studentName: "Benjamin Bioh", rollNumber: "UCC-2026-0510", classScore: "24.0", examScore: "57.0" },
    { studentId: "st-28", studentName: "Patricia Darko", rollNumber: "UCC-2026-1407", classScore: "26.0", examScore: "60.0" },
    { studentId: "st-29", studentName: "Albert Koomson", rollNumber: "UCC-2026-0122", classScore: "13.0", examScore: "32.0" },
    { studentId: "st-30", studentName: "Veronica Lamptey", rollNumber: "UCC-2026-1899", classScore: "28.0", examScore: "64.0" }
  ])

  // --- VALUE MUTATOR INTERCEPTOR ---
  const handleCellValueChange = (rowId: string, columnKey: string, newValue: string) => {
    // Input sanitation mapping floating point numerical characters
    if (newValue !== "" && newValue !== "." && isNaN(Number(newValue))) return

    const maxThreshold = columnKey === "classScore" ? 30 : 70
    if (parseFloat(newValue) > maxThreshold) {
      toast.error(`Value error. Max capacity for ${columnKey === "classScore" ? "Class Mark" : "Exam Mark"} is ${maxThreshold}`)
      return
    }

    setRecords((prev) =>
      prev.map((row) => (row.studentId === rowId ? { ...row, [columnKey]: newValue } : row))
    )
  }

  // --- DYNAMIC COLUMNS SETUP ---
  const gridColumns = useMemo<DataGridColumn<StudentGradeRow>[]>(() => [
    { key: "rollNumber", header: "Index Key", className: "w-36 font-mono text-zinc-500 text-[11px]" },
    { key: "studentName", header: "Student Profile Identity", className: "flex-1 text-left font-medium text-zinc-900 dark:text-zinc-100" },
    { key: "classScore", header: "Class Mark (Max 30)", className: "w-44 bg-amber-50/10 dark:bg-amber-950/5 text-center font-semibold", editable: true, placeholder: "0.0" },
    { key: "examScore", header: "Exam Mark (Max 70)", className: "w-44 bg-sky-50/10 dark:bg-sky-950/5 text-center font-semibold", editable: true, placeholder: "0.0" },
    {
      key: "total",
      header: "Total (100)",
      className: "w-28 text-center font-mono font-bold bg-zinc-50/50 dark:bg-zinc-900/40 text-foreground"
    },
    {
      key: "grade",
      header: "Grade",
      className: "w-24 text-center font-mono text-xs"
    },
    {
      key: "remark",
      header: "Remarks Context",
      className: "w-36 text-center text-muted-foreground text-[11px] truncate"
    }
  ], [])

  // Inject calculation layers directly into dataset projection pipelines
  const computedRecords = useMemo(() => {
    return records.map((row) => {
      const metrics = getGradeMetrics(row.classScore, row.examScore)
      return {
        ...row,
        total: metrics.total,
        // Wrap elements with semantic layout formatting context tokens directly
        grade: <span className={metrics.style}>{metrics.grade}</span>,
        remark: metrics.remark
      }
    })
  }, [records])

  // --- RADIAL QUERY FILTER MATRIX ---
  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return computedRecords
    return computedRecords.filter(
      (r) =>
        r.studentName.toLowerCase().includes(query) ||
        r.rollNumber.toLowerCase().includes(query)
    )
  }, [computedRecords, searchQuery])

  // --- PERSISTENCE DISPATCH LAYER ---
  const handleCommitGrades = async () => {
    try {
      setIsSubmitting(true)
      // Simulate infrastructure write transaction latency
      await new Promise((resolve) => setTimeout(resolve, 1200))
      toast.success("Grades committed successfully", {
        description: `All records written to ${selectedClass} Registry via ${selectedSubject} modules.`
      })
    } catch {
      toast.error("Transaction stream connection error.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="w-full flex-1 min-h-0 flex flex-col bg-transparent pt-6 px-6 pb-4 space-y-4 overflow-hidden">
      
      {/* HUD Header Blocks */}
      <div className="shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-4xl tracking-tight text-foreground font-medium">
            Continuous Assessment Sheet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live infrastructure grade ledger. Rapid keyboard data synchronization framework mapping class metrics.
          </p>
        </div>

        <Button
          disabled={isSubmitting}
          onClick={handleCommitGrades}
          className="h-8 gap-1.5 px-3 text-xs font-medium shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
        >
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Commit Class Scores</span>
        </Button>
      </div>

      {/* FILTER CONTROLS HUB - WITH COMBOBOX CONTEXTS */}
      <div className="shrink-0 flex items-center justify-between w-full  p-3 rounded-md border-none gap-4">
        <div className="flex items-center gap-4">
          
          {/* Class Select Combo Frame */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tight">Class Group:</span>
            <Combobox 
              items={ACADEMIC_CLASSES} 
              value={selectedClass} 
              onValueChange={(val) => val && setSelectedClass(val)}
            >
              <ComboboxInput placeholder="Select class..." className="h-8 text-xs w-44 bg-background" />
              <ComboboxContent>
                <ComboboxEmpty>No match found.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item} className="text-xs">
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800" />

          {/* Subject Select Combo Frame */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tight">Subject:</span>
            <Combobox 
              items={CURRICULUM_SUBJECTS} 
              value={selectedSubject} 
              onValueChange={(val) => val && setSelectedSubject(val)}
            >
              <ComboboxInput placeholder="Select subject..." className="h-8 text-xs w-52 bg-background" />
              <ComboboxContent>
                <ComboboxEmpty>No match found.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item} className="text-xs">
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

        </div>

        {/* Global Roster String Filter Box */}
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by student name or index..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-400"
          />
        </div>
      </div>

      {/* FULL RESPONSIVE WORKING SHEET ARCHITECTURE */}
      <div className="w-full flex-1 min-h-0 overflow-hidden">
        <UniversalEditableGrid
          data={filteredRecords}
          columns={gridColumns}
          rowId={(row) => row.studentId}
          selectable={true}
          emptyMessage="No matching records intersect your active query vectors."
          onCellValueChange={handleCellValueChange}
        />
      </div>

    </main>
  )
}