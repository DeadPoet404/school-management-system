"use client"

import * as React from "react"
import { useEffect, useRef, useMemo, useCallback, useState } from "react"
import { Clock, Coffee, Plus, Trash2, Layers, BookOpen, GraduationCap, Loader2 } from "lucide-react"
import { TimepickerUI } from "timepicker-ui"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner" // Integrated sleek sonner handler
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

// --- TYPES & SCHEMAS (API ALIGNED CONTRACTS) ---
export interface BreakSlot {
  id: string
  name: string
  startTime: string
  endTime: string
}

export interface PeriodSlot {
  startTime: string
  endTime: string
}

export interface SubjectAssignment {
  id: string
  subjectName: string
  teacherName: string
}

export interface SectionTimeMatrix {
  periodsCount: number
  periods: PeriodSlot[]
  breaks: BreakSlot[]
  subjects: SubjectAssignment[]
}

// Constant Layout Configurations
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

const AVAILABLE_TEACHERS = [
  "Mr. Emmanuel Mensah",
  "Mrs. Sarah Awotwe",
  "Dr. Isaac Boateng",
  "Miss Abigail Quansah",
  "Mr. Joseph Donkor",
  "Mad. Elizabeth Arthur",
  "Mr. Kojo Appiah",
] as const

const INITIAL_TIMETABLE_MATRIX: Record<string, SectionTimeMatrix> = {
  "pre-school": { periodsCount: 4, periods: Array(4).fill({ startTime: "", endTime: "" }), breaks: [{ id: "ps-b1", name: "Nap & Snack", startTime: "10:00 AM", endTime: "10:40 AM" }], subjects: [] },
  "nursery-1": { periodsCount: 4, periods: Array(4).fill({ startTime: "", endTime: "" }), breaks: [{ id: "n1-b1", name: "Recess Break", startTime: "10:00 AM", endTime: "10:40 AM" }], subjects: [] },
  "nursery-2": { periodsCount: 4, periods: Array(4).fill({ startTime: "", endTime: "" }), breaks: [{ id: "n2-b1", name: "Recess Break", startTime: "10:00 AM", endTime: "10:40 AM" }], subjects: [] },
  "kindergarten-1": { periodsCount: 5, periods: Array(5).fill({ startTime: "", endTime: "" }), breaks: [{ id: "kg1-b1", name: "Mid-Morning Break", startTime: "10:00 AM", endTime: "10:30 AM" }], subjects: [] },
  "kindergarten-2": { periodsCount: 5, periods: Array(5).fill({ startTime: "", endTime: "" }), breaks: [{ id: "kg2-b1", name: "Mid-Morning Break", startTime: "10:00 AM", endTime: "10:30 AM" }], subjects: [] },
  "grade-1": { periodsCount: 6, periods: Array(6).fill({ startTime: "", endTime: "" }), breaks: [{ id: "g1-b1", name: "First Break", startTime: "10:00 AM", endTime: "10:20 AM" }, { id: "g1-b2", name: "Lunch Break", startTime: "12:00 PM", endTime: "12:40 PM" }], subjects: [{ id: "g1-s1", subjectName: "Mathematics", teacherName: "Mr. Emmanuel Mensah" }] },
  "grade-2": { periodsCount: 6, periods: Array(6).fill({ startTime: "", endTime: "" }), breaks: [{ id: "g2-b1", name: "First Break", startTime: "10:00 AM", endTime: "10:20 AM" }, { id: "g2-b2", name: "Lunch Break", startTime: "12:00 PM", endTime: "12:40 PM" }], subjects: [] },
  "grade-3": { periodsCount: 6, periods: Array(6).fill({ startTime: "", endTime: "" }), breaks: [{ id: "g3-b1", name: "First Break", startTime: "10:00 AM", endTime: "10:20 AM" }, { id: "g3-b2", name: "Lunch Break", startTime: "12:00 PM", endTime: "12:40 PM" }], subjects: [] },
  "grade-4": { periodsCount: 6, periods: Array(6).fill({ startTime: "", endTime: "" }), breaks: [{ id: "g4-b1", name: "First Break", startTime: "10:00 AM", endTime: "10:20 AM" }, { id: "g4-b2", name: "Lunch Break", startTime: "12:00 PM", endTime: "12:40 PM" }], subjects: [] },
  "grade-5": { periodsCount: 6, periods: Array(6).fill({ startTime: "", endTime: "" }), breaks: [{ id: "g5-b1", name: "First Break", startTime: "10:00 AM", endTime: "10:20 AM" }, { id: "g5-b2", name: "Lunch Break", startTime: "12:00 PM", endTime: "12:40 PM" }], subjects: [] },
  "grade-6": { periodsCount: 6, periods: Array(6).fill({ startTime: "", endTime: "" }), breaks: [{ id: "g6-b1", name: "First Break", startTime: "10:00 AM", endTime: "10:20 AM" }, { id: "g6-b2", name: "Lunch Break", startTime: "12:00 PM", endTime: "12:40 PM" }], subjects: [] },
  "jhs-1": { periodsCount: 8, periods: Array(8).fill({ startTime: "", endTime: "" }), breaks: [{ id: "j1-b1", name: "Morning Intermission", startTime: "10:20 AM", endTime: "10:45 AM" }, { id: "j1-b2", name: "Main Lunch Break", startTime: "01:00 PM", endTime: "01:45 PM" }], subjects: [] },
  "jhs-2": { periodsCount: 8, periods: Array(8).fill({ startTime: "", endTime: "" }), breaks: [{ id: "j2-b1", name: "Morning Intermission", startTime: "10:20 AM", endTime: "10:45 AM" }, { id: "j2-b2", name: "Main Lunch Break", startTime: "01:00 PM", endTime: "01:45 PM" }], subjects: [] },
  "jhs-3": { periodsCount: 8, periods: Array(8).fill({ startTime: "", endTime: "" }), breaks: [{ id: "j3-b1", name: "Morning Intermission", startTime: "10:20 AM", endTime: "10:45 AM" }, { id: "j3-b2", name: "Main Lunch Break", startTime: "01:00 PM", endTime: "01:45 PM" }], subjects: [] },
}

// --- STANDALONE TIME PICKER COMPONENT ---
interface TimePickerInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string
  onChange?: (value: string) => void
}

function TimePickerInput({ value, onChange, className, ...props }: TimePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<TimepickerUI | null>(null)

  const options = useMemo(() => ({
    ui: { theme: 'basic' as const },
    clock: { type: '12h' as const }
  }), [])

  useEffect(() => {
    if (!inputRef.current) return

    pickerRef.current = new TimepickerUI(inputRef.current, options)
    pickerRef.current.create()

    const currentInput = inputRef.current
    const handleTimeAccept = () => {
      if (onChange) onChange(currentInput.value)
    }

    currentInput.addEventListener("accept", handleTimeAccept)

    return () => {
      currentInput.removeEventListener("accept", handleTimeAccept)
      pickerRef.current?.destroy()
    }
  }, [options, onChange])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        "h-8 w-full text-xs rounded border border-stone-200 bg-background px-3 tracking-tight outline-none cursor-pointer focus:border-stone-400 transition-colors",
        className
      )}
      {...props}
    />
  )
}

// --- MAIN SETUP UTILITY VIEWER ---
export function TimetableStructureSetup() {
  const [activeSection, setActiveSection] = useState<string>("pre-school")
  const [matrixState, setMatrixState] = useState<Record<string, SectionTimeMatrix>>(INITIAL_TIMETABLE_MATRIX)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Sync Data on Component Mount
  useEffect(() => {
    const fetchMatrixRegistry = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("http://localhost:5000/api/timetable/matrix")
        const payload = await response.json()
        
        if (payload.success && payload.data && Object.keys(payload.data).length > 0) {
          setMatrixState(prev => ({ ...prev, ...payload.data }))
        }
      } catch (error) {
        console.error("[Timetable Matrix Fetch Error]:", error)
        toast.error("Failed to recover matrix data configurations.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchMatrixRegistry()
  }, [])

  // Memoized Grid Metrics
  const currentMatrix = useMemo(() => {
    return matrixState[activeSection] || { periodsCount: 0, periods: [], breaks: [], subjects: [] }
  }, [matrixState, activeSection])

  const lowerAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(0, 7), [])
  const upperAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(7), [])
  const activeSectionLabel = useMemo(() => ACADEMIC_SECTIONS.find(s => s.id === activeSection)?.label || "", [activeSection])

  // Multi-State Immutable Target Mutators
  const handlePeriodsCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    const sanitizedVal = !isNaN(val) && val >= 0 ? Math.min(val, 12) : 0

    setMatrixState(prev => {
      const current = prev[activeSection]
      const updatedPeriods = [...current.periods]

      if (sanitizedVal > current.periods.length) {
        while (updatedPeriods.length < sanitizedVal) {
          updatedPeriods.push({ startTime: "", endTime: "" })
        }
      } else {
        updatedPeriods.splice(sanitizedVal)
      }

      return {
        ...prev,
        [activeSection]: { ...current, periodsCount: sanitizedVal, periods: updatedPeriods }
      }
    })
  }, [activeSection])

  const updatePeriodTime = useCallback((index: number, field: keyof PeriodSlot, timeValue: string) => {
    setMatrixState(prev => {
      const current = prev[activeSection]
      const updatedPeriods = current.periods.map((p, i) => 
        i === index ? { ...p, [field]: timeValue } : p
      )
      return { ...prev, [activeSection]: { ...current, periods: updatedPeriods } }
    })
  }, [activeSection])

  const addBreak = useCallback(() => {
    const newId = `tmp_${Math.random().toString(36).substring(2, 9)}`
    setMatrixState(prev => {
      const current = prev[activeSection]
      return {
        ...prev,
        [activeSection]: {
          ...current,
          breaks: [...current.breaks, { id: newId, name: "New Intermission", startTime: "12:00 PM", endTime: "12:30 PM" }]
        }
      }
    })
  }, [activeSection])

  const removeBreak = useCallback((id: string) => {
    setMatrixState(prev => {
      const current = prev[activeSection]
      return {
        ...prev,
        [activeSection]: { ...current, breaks: current.breaks.filter(b => b.id !== id) }
      }
    })
  }, [activeSection])

  const updateBreak = useCallback((id: string, field: keyof BreakSlot, value: string) => {
    setMatrixState(prev => {
      const current = prev[activeSection]
      return {
        ...prev,
        [activeSection]: {
          ...current,
          breaks: current.breaks.map(b => b.id === id ? { ...b, [field]: value } : b)
        }
      }
    })
  }, [activeSection])

  const addSubject = useCallback(() => {
    const newId = `tmp_${Math.random().toString(36).substring(2, 9)}`
    setMatrixState(prev => {
      const current = prev[activeSection]
      return {
        ...prev,
        [activeSection]: {
          ...current,
          subjects: [...(current.subjects || []), { id: newId, subjectName: "", teacherName: "" }]
        }
      }
    })
  }, [activeSection])

  const removeSubject = useCallback((id: string) => {
    setMatrixState(prev => {
      const current = prev[activeSection]
      return {
        ...prev,
        [activeSection]: { ...current, subjects: (current.subjects || []).filter(s => s.id !== id) }
      }
    })
  }, [activeSection])

  const updateSubject = useCallback((id: string, field: keyof SubjectAssignment, value: string) => {
    setMatrixState(prev => {
      const current = prev[activeSection]
      return {
        ...prev,
        [activeSection]: {
          ...current,
          subjects: (current.subjects || []).map(s => s.id === id ? { ...s, [field]: value } : s)
        }
      }
    })
  }, [activeSection])

  // Submit Operations Layer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSubmitting(true)
      const response = await fetch("http://localhost:5000/api/timetable/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: matrixState }),
      })
      
      const payload = await response.json()
      if (payload.success) {
        toast.success("Timetable matrix updated", {
          description: "All configurations successfully written to Prisma structural layers.",
        })
      } else {
        toast.error("Process aborted", { description: payload.error })
      }
    } catch (error) {
      console.error("[Matrix Upload Error]:", error)
      toast.error("Transmission error", { description: "Could not safely hit the configuration server." })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-transparent gap-3">
        <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
        <span className="text-xs font-medium text-stone-500 tracking-tight">Syncing Operational Timetable Matrices...</span>
      </div>
    )
  }

  return (
    <main className="flex-1 h-full flex flex-col bg-transparent px-8 py-6 overflow-hidden">
      {/* Header Block */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tracking-wide uppercase font-bold text-stone-400">
          Core Academic Operations / Class Framework Layout
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold text-foreground capitalize">
              Timetable Structure Setup
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure dynamic period pairings, distinct run configurations, and fixed breaks completely split by institutional grade blocks.
            </p>
          </div>
        </div>
      </div>

      {/* GRADE TIER SELECTOR HUD */}
      <div className="mt-5 shrink-0 flex flex-col gap-1.5 max-w-3xl">
        <Label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
          <Layers className="h-3 w-3" /> Select Institutional Grade Tier
        </Label>
        
        <div className="w-full flex flex-col gap-2.5">
          {/* ROW 1: Early Childhood to Lower Primary Base */}
          <div className="w-full flex items-center bg-stone-100 p-1.5 rounded-lg border border-stone-200/40">
            {lowerAcademicTier.map((section, idx) => (
              <React.Fragment key={section.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex-1 text-center py-1 rounded text-[11px] font-medium transition-all tracking-tight truncate px-1",
                    activeSection === section.id
                      ? "bg-white text-stone-900 shadow-sm border border-stone-200/20 font-semibold"
                      : "text-stone-500 hover:text-stone-800 hover:bg-stone-50/60"
                  )}
                >
                  {section.label}
                </button>
                {idx < lowerAcademicTier.length - 1 && (
                  <div className="h-3 w-[1px] bg-stone-300 shrink-0 mx-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ROW 2: Upper Primary to JHS Framework Core */}
          <div className="w-full flex items-center bg-stone-100 p-1.5 rounded-lg border border-stone-200/40">
            {upperAcademicTier.map((section, idx) => (
              <React.Fragment key={section.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex-1 text-center py-1 rounded text-[11px] font-medium transition-all tracking-tight truncate px-1",
                    activeSection === section.id
                      ? "bg-white text-stone-900 shadow-sm border border-stone-200/20 font-semibold"
                      : "text-stone-500 hover:text-stone-800 hover:bg-stone-50/60"
                  )}
                >
                  {section.label}
                </button>
                {idx < upperAcademicTier.length - 1 && (
                  <div className="h-3 w-[1px] bg-stone-300 shrink-0 mx-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-stone-200 dark:border-stone-800 shrink-0 mt-5 mb-6" />

      {/* Form Scroll Area */}
      <ScrollArea className="flex-1 w-full max-w-3xl rounded-none border-none shadow-none bg-transparent">
        <form onSubmit={handleSubmit} className="space-y-12 pr-4 pb-12 bg-transparent">
          
          {/* SECTION 1: PERIOD COUNT SETUP */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-medium text-stone-500">
                1
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 mt-2" />
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Daily Framework Metrics <span className="text-stone-400 font-normal text-xs">({activeSectionLabel})</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Determine total instructional matrix slots running inside an explicit single layout block cycle.</p>
              </div>
              
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="periods-count" className="text-xs font-semibold text-stone-700">
                  Total Periods Per Day <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="periods-count"
                  type="number"
                  min={0}
                  max={12}
                  value={currentMatrix.periodsCount || ""}
                  onChange={handlePeriodsCountChange}
                  className="h-9 text-xs rounded-md border-stone-200 bg-background"
                  placeholder="e.g. 6"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: DYNAMIC TIME SLOTS CONFIGURATION */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-medium text-stone-500">
                2
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 mt-2" />
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Instructional Matrix Slots <span className="text-stone-400 font-normal text-xs">({activeSectionLabel})</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">Map custom paired horizontal run times inside your targeted operational section sequence.</p>
              </div>

              <div className="space-y-3 max-w-2xl">
                {currentMatrix.periods.map((period, index) => {
                  const periodNum = index + 1
                  return (
                    <div key={`${activeSection}-period-${periodNum}`} className="flex items-center gap-4 bg-stone-50/50 p-3 rounded-lg border border-stone-100/80">
                      <div className="flex items-center gap-2 min-w-[90px]">
                        <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                        <span className="text-xs font-semibold text-stone-700">Period {periodNum}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1">
                          <TimePickerInput 
                            value={period.startTime}
                            onChange={(val) => updatePeriodTime(index, "startTime", val)}
                            placeholder="Start Time"
                            aria-label={`${activeSection} Period ${periodNum} Start Time`}
                          />
                        </div>
                        <span className="text-stone-300 text-xs font-medium">to</span>
                        <div className="flex-1">
                          <TimePickerInput 
                            value={period.endTime}
                            onChange={(val) => updatePeriodTime(index, "endTime", val)}
                            placeholder="End Time"
                            aria-label={`${activeSection} Period ${periodNum} End Time`}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
                {currentMatrix.periodsCount === 0 && (
                  <p className="text-xs text-stone-400 italic">Adjust execution slots counter above to map time vectors for this layer.</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: INSTITUTIONAL BREAKS CONFIGURATION */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-medium text-stone-500">
                3
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 mt-2" />
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between max-w-2xl">
                <div>
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    Fixed Institutional Breaks <span className="text-stone-400 font-normal text-xs">({activeSectionLabel})</span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">Establish non-instructional programmatic interruptions inside the operational timetable matrix grid.</p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addBreak}
                  className="h-8 text-[11px] font-medium border-stone-200 gap-1 px-2.5"
                >
                  <Plus className="h-3 w-3" /> Add Break
                </Button>
              </div>

              <div className="space-y-3 max-w-2xl">
                {currentMatrix.breaks.map((brk) => (
                  <div key={brk.id} className="flex items-center gap-4 bg-stone-50/30 p-3 rounded-lg border border-stone-100/60 group/break">
                    <div className="flex items-center gap-2 w-1/3">
                      <Coffee className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      <Input
                        type="text"
                        value={brk.name}
                        onChange={(e) => updateBreak(brk.id, "name", e.target.value)}
                        className="h-8 text-xs rounded border-stone-200 font-medium bg-background px-2"
                        placeholder="Break Label"
                      />
                    </div>
                    
                    <div className="flex items-center gap-3 flex-1">
                      <TimePickerInput
                        value={brk.startTime}
                        onChange={(val) => updateBreak(brk.id, "startTime", val)}
                        placeholder="Start Time"
                      />
                      <span className="text-stone-300 text-xs font-medium">to</span>
                      <TimePickerInput
                        value={brk.endTime}
                        onChange={(val) => updateBreak(brk.id, "endTime", val)}
                        placeholder="End Time"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeBreak(brk.id)}
                      className="h-8 w-8 p-0 text-stone-400 hover:text-red-600 rounded opacity-100 md:opacity-0 group-hover/break:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {currentMatrix.breaks.length === 0 && (
                  <p className="text-xs text-stone-400 italic">No structured structural layout configurations mapped for this segment.</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: SUBJECTS & FACULTY ASSIGNMENTS */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-medium text-stone-500">
                4
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between max-w-2xl">
                <div>
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    Subject & Faculty Allocation <span className="text-stone-400 font-normal text-xs">({activeSectionLabel})</span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">Map core curricular subject fields and pair active operational teachers to this tier matrix.</p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addSubject}
                  className="h-8 text-[11px] font-medium border-stone-200 gap-1 px-2.5"
                >
                  <Plus className="h-3 w-3" /> Add Assignment
                </Button>
              </div>

              <div className="space-y-3 max-w-2xl">
                {(currentMatrix.subjects || []).map((sub) => (
                  <div key={sub.id} className="flex items-center gap-4 bg-stone-50/30 p-3 rounded-lg border border-stone-100/60 group/subject">
                    {/* Subject Field Column */}
                    <div className="flex items-center gap-2 flex-1">
                      <BookOpen className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      <Input
                        type="text"
                        value={sub.subjectName}
                        onChange={(e) => updateSubject(sub.id, "subjectName", e.target.value)}
                        className="h-8 text-xs rounded border-stone-200 font-medium bg-background px-2"
                        placeholder="Subject (e.g. Science)"
                      />
                    </div>
                    
                    {/* Combobox Allocation Column */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <GraduationCap className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Combobox 
                          items={AVAILABLE_TEACHERS}
                          value={sub.teacherName}
                          onValueChange={(val) => updateSubject(sub.id, "teacherName", val ?? "")}
                        >
                          <ComboboxInput 
                            placeholder="Select Teacher" 
                            className="h-8 text-xs w-full rounded border border-stone-200 bg-background px-3 outline-none" 
                          />
                          <ComboboxContent>
                            <ComboboxEmpty>No teachers found.</ComboboxEmpty>
                            <ComboboxList>
                              {(teacher) => (
                                <ComboboxItem key={teacher} value={teacher}>
                                  {teacher}
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeSubject(sub.id)}
                      className="h-8 w-8 p-0 text-stone-400 hover:text-red-600 rounded opacity-100 md:opacity-0 group-hover/subject:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {(currentMatrix.subjects || []).length === 0 && (
                  <p className="text-xs text-stone-400 italic">No structured subjects or faculty allocations paired with this academic group.</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-stone-200 bg-transparent max-w-2xl">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="h-9 text-xs font-medium px-4 bg-stone-900 text-white flex items-center gap-1.5 min-w-[190px] justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Schema Changes...
                </>
              ) : (
                "Initialize Timetable Framework"
              )}
            </Button>
          </div>
        </form>
      </ScrollArea>
    </main>
  )
}