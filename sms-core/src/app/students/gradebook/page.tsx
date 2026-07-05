"use client"

import * as React from "react"
import { useEffect, useMemo, useCallback, useState, useRef } from "react"
import { 
  Layers, 
  BookOpen, 
  Save, 
  Search, 
  FileSpreadsheet, 
  Loader2, 
  AlertCircle 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// --- TYPES & SCHEMAS (API CONTRACTUAL BOUNDARIES) ---
export interface StudentGradeRow {
  studentId: string
  studentName: string
  rollNumber: string
  classScore: string 
  examScore: string  
}

const ACADEMIC_SECTIONS = [
  { id: "pre-school", label: "Pre-School" },
  { id: "nursery-1", label: "Nursery 1" },
  { id: "nursery-2", label: "Nursery 2" },
  { id: "kindergarten-1", label: "KG 1" },
  { id: "kindergarten-2", label: "KG 2" },
  { id: "grade-1", label: "Grade 1" },
  { id: "grade-2", label: "Grade 2" },
  { id: "grade-3", label: "Grade 3" },
  { id: "grade-4", label: "Grade 4" },
  { id: "grade-5", label: "Grade 5" },
  { id: "grade-6", label: "Grade 6" },
  { id: "jhs-1", label: "JHS 1" },
  { id: "jhs-2", label: "JHS 2" },
  { id: "jhs-3", label: "JHS 3" },
] as const

// Robust mock dataset containing 30 students matching typical school structures
const MOCK_STUDENT_ROSTER: StudentGradeRow[] = [
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
]

// --- INLINE AUTOMATED ASSESSMENT LOGIC ---
function calculateGradeMetrics(classScoreStr: string, examScoreStr: string) {
  const cScore = parseFloat(classScoreStr) || 0
  const eScore = parseFloat(examScoreStr) || 0
  const total = cScore + eScore

  let grade = "F"
  let remark = "Fail"
  let colorClass = "text-rose-500"

  if (total >= 80) { grade = "A1"; remark = "Excellent"; colorClass = "text-emerald-600 dark:text-emerald-400 font-bold" }
  else if (total >= 70) { grade = "B2"; remark = "Very Good"; colorClass = "text-emerald-500 dark:text-emerald-500 font-medium" }
  else if (total >= 65) { grade = "B3"; remark = "Good"; colorClass = "text-amber-600 dark:text-amber-400" }
  else if (total >= 60) { grade = "C4"; remark = "Credit"; colorClass = "text-amber-500" }
  else if (total >= 55) { grade = "C5"; remark = "Credit"; colorClass = "text-zinc-700 dark:text-zinc-300" }
  else if (total >= 50) { grade = "C6"; remark = "Credit"; colorClass = "text-zinc-600 dark:text-zinc-400" }
  else if (total >= 45) { grade = "D7"; remark = "Pass"; colorClass = "text-zinc-500" }
  else if (total >= 40) { grade = "E8"; remark = "Pass"; colorClass = "text-zinc-400" }

  return { total: total.toFixed(1), grade, remark, colorClass }
}

export default function GradeBookSpreadsheet() {
  const [activeSection, setActiveSection] = useState<string>("grade-1")
  const [availableSubjects] = useState<{ id: string; name: string }[]>([
    { id: "math", name: "Mathematics" },
    { id: "science", name: "Integrated Science" },
    { id: "english", name: "English Language" },
  ])
  const [activeSubjectId, setActiveSubjectId] = useState<string>("math")
  
  // Seed the array directly with our 30 test records
  const [gradeRecords, setGradeRecords] = useState<StudentGradeRow[]>(MOCK_STUDENT_ROSTER)
  const [searchQuery, setSearchQuery] = useState<string>("")
  
  const [isLoading, setIsLoading] = useState<boolean>(false) // Set to false so mock rows render immediately
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // --- RECOVER MATRIX RECORDS FROM DATA SYSTEM ---
  useEffect(() => {
    const fetchGradebookData = async () => {
      try {
        // Uncomment the next line if you want the visual loading state to trigger during live testing
        // setIsLoading(true)
        const response = await fetch(`http://localhost:5000/api/grades?classId=${activeSection}&subjectId=${activeSubjectId}`)
        const payload = await response.json()
        
        if (payload.success && payload.data) {
          setGradeRecords(payload.data)
        } else {
          // Keep mock records active if API responds with a non-success state
          setGradeRecords(MOCK_STUDENT_ROSTER)
        }
      } catch (error) {
        console.warn("[API Endpoint Offline] Defaulting to local testing mock dataset.")
        setGradeRecords(MOCK_STUDENT_ROSTER)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGradebookData()
  }, [activeSection, activeSubjectId])

  const lowerAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(0, 7), [])
  const upperAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(7), [])
  const activeSectionLabel = useMemo(() => ACADEMIC_SECTIONS.find(s => s.id === activeSection)?.label || "", [activeSection])

  // --- SPREADSHEET INLINE FIELD MUTATORS ---
  const updateScoreCell = useCallback((studentId: string, field: "classScore" | "examScore", val: string) => {
    // Basic sanitization allowing single decimal point typing loops
    if (val !== "" && val !== "." && isNaN(Number(val))) return

    const maxLimit = field === "classScore" ? 30 : 70
    const parsed = parseFloat(val)
    if (!isNaN(parsed) && parsed > maxLimit) {
      toast.error(`Value threshold error. Max allowed for this field is ${maxLimit}`)
      return
    }

    setGradeRecords(prev => prev.map(row => 
      row.studentId === studentId ? { ...row, [field]: val } : row
    ))
  }, [])

  // --- GRID INTERFACE KEYBOARD AXIS CONTROLS ---
  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: "classScore" | "examScore") => {
    const inputs = containerRef.current?.querySelectorAll("input[data-sheet-cell]") as NodeListOf<HTMLInputElement>
    if (!inputs) return

    let targetIdx = -1
    const currentPos = index * 2 + (field === "examScore" ? 1 : 0)

    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault()
      targetIdx = currentPos + 2
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      targetIdx = currentPos - 2
    } else if (e.key === "ArrowRight" && field === "classScore") {
      targetIdx = currentPos + 1
    } else if (e.key === "ArrowLeft" && field === "examScore") {
      targetIdx = currentPos - 1
    }

    if (targetIdx >= 0 && targetIdx < inputs.length) {
      inputs[targetIdx].focus()
      inputs[targetIdx].select()
    }
  }

  // --- LIVE STRING FILTERS ---
  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return gradeRecords
    return gradeRecords.filter(r => 
      r.studentName.toLowerCase().includes(query) || 
      r.rollNumber.toLowerCase().includes(query)
    )
  }, [gradeRecords, searchQuery])

  // --- DATA TRANSFERS LAYER ---
  const saveGradebookState = async () => {
    try {
      setIsSubmitting(true)
      const response = await fetch("http://localhost:5000/api/grades/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: activeSection,
          subjectId: activeSubjectId,
          records: gradeRecords
        })
      })

      const payload = await response.json()
      if (payload.success) {
        toast.success("Grades committed successfully", {
          description: `All structural modifications written to ${activeSectionLabel} registry tables.`
        })
      } else {
        toast.error("Transaction Aborted", { description: payload.error })
      }
    } catch (error) {
      console.error("[Gradebook Bulk Save Error]:", error)
      toast.error("Transmission fault when establishing data stream channels. Local data remains active in runtime context.")
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
          disabled={isSubmitting || isLoading}
          onClick={saveGradebookState}
          className="h-8 gap-1.5 px-3 text-xs font-medium shadow-none bg-zinc-900 text-zinc-50 hover:bg-zinc-800/90 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200/90 transition-colors"
        >
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Commit Class Scores</span>
        </Button>
      </div>

      {/* INSTALMENT GRADE LEVEL MULTI-BAR */}
      <div className="shrink-0 flex flex-col gap-1.5 w-full">
        <Label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1 font-mono">
          <Layers className="h-3 w-3" /> Select Target Core Group
        </Label>
        
        <div className="w-full flex flex-col gap-2">
          {/* Row 1 Layout Grid */}
          <div className="w-full flex items-center bg-zinc-50 dark:bg-zinc-900/50 p-1 rounded border border-zinc-200/60 dark:border-zinc-800/60">
            {lowerAcademicTier.map((section, idx) => (
              <React.Fragment key={section.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex-1 text-center py-1 rounded text-xs font-medium transition-all tracking-tight truncate px-1",
                    activeSection === section.id
                      ? "bg-background text-foreground shadow-sm border border-zinc-200 dark:border-zinc-800 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50"
                  )}
                >
                  {section.label}
                </button>
                {idx < lowerAcademicTier.length - 1 && <div className="h-3 w-[1px] bg-zinc-200 dark:bg-zinc-800 shrink-0 mx-1" />}
              </React.Fragment>
            ))}
          </div>

          {/* Row 2 Layout Grid */}
          <div className="w-full flex items-center bg-zinc-50 dark:bg-zinc-900/50 p-1 rounded border border-zinc-200/60 dark:border-zinc-800/60">
            {upperAcademicTier.map((section, idx) => (
              <React.Fragment key={section.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex-1 text-center py-1 rounded text-xs font-medium transition-all tracking-tight truncate px-1",
                    activeSection === section.id
                      ? "bg-background text-foreground shadow-sm border border-zinc-200 dark:border-zinc-800 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50"
                  )}
                >
                  {section.label}
                </button>
                {idx < upperAcademicTier.length - 1 && <div className="h-3 w-[1px] bg-zinc-200 dark:bg-zinc-800 shrink-0 mx-1" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* CONTROLS BAR: FILTERS + SEARCH */}
      <div className="shrink-0 flex items-center justify-between w-full bg-zinc-50/50 dark:bg-zinc-900/20 p-3 rounded-md border border-zinc-100 dark:border-zinc-900 gap-4">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tight mr-1">Subject Module:</span>
          <div className="flex items-center gap-1 bg-background p-1 rounded border border-zinc-200 dark:border-zinc-800">
            {availableSubjects.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubjectId(sub.id)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-all",
                  activeSubjectId === sub.id 
                    ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950 font-semibold" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>

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

      {/* FLUID FULL-WIDTH SPREADSHEET ARCHITECTURE */}
      <div ref={containerRef} className="w-full flex-1 min-h-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-md bg-background shadow-none">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground font-mono">Assembling matrix processing grids...</span>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Native Fixed Header Matrix */}
            <div className="flex items-center bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold text-xs h-9 tracking-tight select-none shrink-0 font-mono">
              <div className="w-16 text-center border-r border-zinc-200 dark:border-zinc-800">Index</div>
              <div className="flex-1 pl-4 border-r border-zinc-200 dark:border-zinc-800 text-left">Student Profile Credentials</div>
              <div className="w-48 text-center border-r border-zinc-200 dark:border-zinc-800 bg-amber-50/20 dark:bg-amber-950/10 text-amber-900 dark:text-amber-400 font-bold">Class Mark (Max 30)</div>
              <div className="w-48 text-center border-r border-zinc-200 dark:border-zinc-800 bg-sky-50/20 dark:bg-sky-950/10 text-sky-900 dark:text-sky-400 font-bold">Exam Mark (Max 70)</div>
              <div className="w-32 text-center border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 text-foreground font-bold">Total (100)</div>
              <div className="w-24 text-center border-r border-zinc-200 dark:border-zinc-800">Grade</div>
              <div className="w-36 text-center">Remarks Context</div>
            </div>

            {/* Scrollable Core Assessment Roster Viewport */}
            <ScrollArea className="flex-1">
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredRecords.map((row, index) => {
                  const calculated = calculateGradeMetrics(row.classScore, row.examScore)
                  
                  return (
                    <div 
                      key={row.studentId} 
                      className="flex items-center text-xs h-9 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/20 transition-colors tracking-tight font-medium text-foreground"
                    >
                      {/* Grid Counter Coordinates */}
                      <div className="w-16 text-center border-r border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-mono text-[11px]">
                        {(index + 1).toString().padStart(2, "0")}
                      </div>

                      {/* Identity Layout Segments */}
                      <div className="flex-1 pl-4 border-r border-zinc-200 dark:border-zinc-800 truncate flex flex-col justify-center text-left">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 leading-tight truncate">{row.studentName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono tracking-tight">{row.rollNumber}</span>
                      </div>

                      {/* Dynamic Class Field inputs */}
                      <div className="w-48 h-full border-r border-zinc-200 dark:border-zinc-800 p-0.5 bg-amber-50/[0.04] dark:bg-amber-950/[0.02] focus-within:bg-background transition-all">
                        <input
                          data-sheet-cell
                          type="text"
                          inputMode="decimal"
                          value={row.classScore}
                          onChange={(e) => updateScoreCell(row.studentId, "classScore", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index, "classScore")}
                          className="w-full h-full text-center bg-transparent focus:bg-background outline-none font-mono text-xs focus:ring-1 focus:ring-zinc-400 rounded-sm transition-all tracking-tight"
                          placeholder="- -"
                        />
                      </div>

                      {/* Dynamic Exam Field inputs */}
                      <div className="w-48 h-full border-r border-zinc-200 dark:border-zinc-800 p-0.5 bg-sky-50/[0.04] dark:bg-sky-950/[0.02] focus-within:bg-background transition-all">
                        <input
                          data-sheet-cell
                          type="text"
                          inputMode="decimal"
                          value={row.examScore}
                          onChange={(e) => updateScoreCell(row.studentId, "examScore", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index, "examScore")}
                          className="w-full h-full text-center bg-transparent focus:bg-background outline-none font-mono text-xs focus:ring-1 focus:ring-zinc-400 rounded-sm transition-all tracking-tight"
                          placeholder="- -"
                        />
                      </div>

                      {/* Dynamic Auto-Aggregated Matrix Computed Totals */}
                      <div className="w-32 text-center border-r border-zinc-200 dark:border-zinc-800 font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-50/20 dark:bg-zinc-900/10">
                        {calculated.total}
                      </div>

                      {/* Performance Metric Symbols */}
                      <div className={cn("w-24 text-center border-r border-zinc-200 dark:border-zinc-800 font-mono tracking-wide text-xs", calculated.colorClass)}>
                        {calculated.grade}
                      </div>

                      {/* Remarks Context Feedback Box */}
                      <div className="w-36 text-center text-muted-foreground font-medium text-[11px] truncate px-2">
                        {calculated.remark}
                      </div>
                    </div>
                  )
                })}

                {filteredRecords.length === 0 && (
                  <div className="p-12 text-center flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                    <AlertCircle className="h-5 w-5 text-zinc-400 stroke-[1.5]" />
                    <p className="text-xs italic font-mono">No matching student assessment matrix paths encounter your specific sequence query.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </main>
  )
}