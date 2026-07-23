"use client"

import * as React from "react"
import {
  BookOpen,
  Clock,
  Coffee,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

const ACADEMIC_SECTIONS = [
  { id: "pre-school", label: "Pre-School", periods: 4 },
  { id: "nursery-1", label: "Nursery 1", periods: 4 },
  { id: "nursery-2", label: "Nursery 2", periods: 4 },
  { id: "kindergarten-1", label: "KG 1", periods: 5 },
  { id: "kindergarten-2", label: "KG 2", periods: 5 },
  { id: "grade-1", label: "Grade 1", periods: 6 },
  { id: "grade-2", label: "Grade 2", periods: 6 },
  { id: "grade-3", label: "Grade 3", periods: 6 },
  { id: "grade-4", label: "Grade 4", periods: 6 },
  { id: "grade-5", label: "Grade 5", periods: 6 },
  { id: "grade-6", label: "Grade 6", periods: 6 },
  { id: "jhs-1", label: "JHS 1", periods: 8 },
  { id: "jhs-2", label: "JHS 2", periods: 8 },
  { id: "jhs-3", label: "JHS 3", periods: 8 },
] as const

const AVAILABLE_TEACHERS = [
  "Mr. Emmanuel Mensah",
  "Mrs. Sarah Awotwe",
  "Dr. Isaac Boateng",
  "Miss Abigail Quansah",
  "Mr. Joseph Donkor",
  "Mad. Elizabeth Arthur",
  "Mr. Kojo Appiah",
]

function createPeriods(count: number): PeriodSlot[] {
  return Array.from({ length: count }, () => ({
    startTime: "",
    endTime: "",
  }))
}

function createInitialMatrix(): Record<string, SectionTimeMatrix> {
  return Object.fromEntries(
    ACADEMIC_SECTIONS.map((section) => [
      section.id,
      {
        periodsCount: section.periods,
        periods: createPeriods(section.periods),
        breaks: [
          {
            id: `${section.id}-morning-break`,
            name: "Morning Break",
            startTime: "10:20",
            endTime: "10:45",
          },
        ],
        subjects: [],
      },
    ])
  )
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function TimetableStructureSetup() {
  const [activeSection, setActiveSection] = React.useState("pre-school")
  const [matrixState, setMatrixState] =
    React.useState<Record<string, SectionTimeMatrix>>(createInitialMatrix)

  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const currentMatrix = matrixState[activeSection] ?? {
    periodsCount: 0,
    periods: [],
    breaks: [],
    subjects: [],
  }

  const activeSectionLabel =
    ACADEMIC_SECTIONS.find((section) => section.id === activeSection)?.label ??
    ""

  const lowerAcademicTier = ACADEMIC_SECTIONS.slice(0, 7)
  const upperAcademicTier = ACADEMIC_SECTIONS.slice(7)

  React.useEffect(() => {
    const loadTimetable = async () => {
      try {
        setIsLoading(true)

        const response = await fetchWithAuth("/timetable/matrix")

        if (!response.ok) {
          return
        }

        const payload = await response.json()

        if (
          payload?.success &&
          payload?.data &&
          typeof payload.data === "object" &&
          Object.keys(payload.data).length > 0
        ) {
          setMatrixState((previous) => ({
            ...previous,
            ...payload.data,
          }))
        }
      } catch {
        // Keep local editable defaults if the timetable API has no saved matrix.
      } finally {
        setIsLoading(false)
      }
    }

    void loadTimetable()
  }, [])

  const updateCurrentMatrix = (
    updater: (matrix: SectionTimeMatrix) => SectionTimeMatrix
  ) => {
    setMatrixState((previous) => ({
      ...previous,
      [activeSection]: updater(
        previous[activeSection] ?? {
          periodsCount: 0,
          periods: [],
          breaks: [],
          subjects: [],
        }
      ),
    }))
  }

  const handlePeriodsCountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const parsed = Number.parseInt(event.target.value, 10)
    const periodsCount = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0), 12)
      : 0

    updateCurrentMatrix((current) => {
      const periods = [...current.periods]

      while (periods.length < periodsCount) {
        periods.push({ startTime: "", endTime: "" })
      }

      return {
        ...current,
        periodsCount,
        periods: periods.slice(0, periodsCount),
      }
    })
  }

  const updatePeriod = (
    index: number,
    field: keyof PeriodSlot,
    value: string
  ) => {
    updateCurrentMatrix((current) => ({
      ...current,
      periods: current.periods.map((period, periodIndex) =>
        periodIndex === index ? { ...period, [field]: value } : period
      ),
    }))
  }

  const addBreak = () => {
    updateCurrentMatrix((current) => ({
      ...current,
      breaks: [
        ...current.breaks,
        {
          id: createId("break"),
          name: "New Break",
          startTime: "12:00",
          endTime: "12:30",
        },
      ],
    }))
  }

  const updateBreak = (
    id: string,
    field: keyof BreakSlot,
    value: string
  ) => {
    updateCurrentMatrix((current) => ({
      ...current,
      breaks: current.breaks.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }))
  }

  const removeBreak = (id: string) => {
    updateCurrentMatrix((current) => ({
      ...current,
      breaks: current.breaks.filter((item) => item.id !== id),
    }))
  }

  const addSubject = () => {
    updateCurrentMatrix((current) => ({
      ...current,
      subjects: [
        ...current.subjects,
        {
          id: createId("subject"),
          subjectName: "",
          teacherName: "",
        },
      ],
    }))
  }

  const updateSubject = (
    id: string,
    field: keyof SubjectAssignment,
    value: string
  ) => {
    updateCurrentMatrix((current) => ({
      ...current,
      subjects: current.subjects.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }))
  }

  const removeSubject = (id: string) => {
    updateCurrentMatrix((current) => ({
      ...current,
      subjects: current.subjects.filter((item) => item.id !== id),
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setIsSubmitting(true)

      const response = await fetchWithAuth("/timetable/matrix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: matrixState,
        }),
      })

      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? "Unable to save timetable.")
      }

      toast.success("Timetable framework saved successfully.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save timetable configuration."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-7rem)] items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        <span className="text-xs font-medium text-stone-500">
          Loading timetable framework...
        </span>
      </div>
    )
  }

  return (
    <main className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden bg-transparent px-8 py-6">
      <div className="shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-400">
          Core Academic Operations / Class Framework Layout
        </div>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Timetable Structure Setup
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Configure periods, breaks, and teacher subject allocations by grade
          level.
        </p>
      </div>

      <div className="mt-5 shrink-0 max-w-5xl">
        <Label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">
          <Layers className="h-3 w-3" />
          Select Institutional Grade Tier
        </Label>

        <div className="mt-2 space-y-2">
          <div className="flex overflow-x-auto rounded-lg border border-stone-200/60 bg-stone-100 p-1.5">
            {lowerAcademicTier.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "min-w-[76px] flex-1 rounded px-2 py-1.5 text-center text-[11px] font-medium transition-all",
                  activeSection === section.id
                    ? "border border-stone-200/40 bg-white font-semibold text-stone-900 shadow-sm"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                )}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className="flex overflow-x-auto rounded-lg border border-stone-200/60 bg-stone-100 p-1.5">
            {upperAcademicTier.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "min-w-[76px] flex-1 rounded px-2 py-1.5 text-center text-[11px] font-medium transition-all",
                  activeSection === section.id
                    ? "border border-stone-200/40 bg-white font-semibold text-stone-900 shadow-sm"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 mb-4 shrink-0 border-t border-stone-200 dark:border-stone-800" />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto min-h-full max-w-3xl space-y-12 pb-12"
        >
          <section className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Step 1
              </p>
              <h2 className="mt-1 text-base font-semibold">
                Daily Framework Metrics ({activeSectionLabel})
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Set the number of instructional periods for this grade tier.
              </p>
            </div>

            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="periods-count">Total Periods Per Day</Label>
              <Input
                id="periods-count"
                type="number"
                min={0}
                max={12}
                value={currentMatrix.periodsCount}
                onChange={handlePeriodsCountChange}
              />
            </div>
          </section>

          <section className="space-y-5 border-t pt-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Step 2
              </p>
              <h2 className="mt-1 text-base font-semibold">
                Instructional Period Slots
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure the start and end time for every period.
              </p>
            </div>

            <div className="space-y-3">
              {currentMatrix.periods.map((period, index) => (
                <div
                  key={`${activeSection}-period-${index}`}
                  className="flex flex-col gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-[105px] items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-stone-400" />
                    <span className="text-xs font-semibold">
                      Period {index + 1}
                    </span>
                  </div>

                  <div className="flex flex-1 items-center gap-3">
                    <Input
                      type="time"
                      value={period.startTime}
                      onChange={(event) =>
                        updatePeriod(index, "startTime", event.target.value)
                      }
                      className="h-8 text-xs"
                    />

                    <span className="text-xs text-stone-400">to</span>

                    <Input
                      type="time"
                      value={period.endTime}
                      onChange={(event) =>
                        updatePeriod(index, "endTime", event.target.value)
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-5 border-t pt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Step 3
                </p>
                <h2 className="mt-1 text-base font-semibold">
                  Fixed Institutional Breaks
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add lunch, recess, assembly, and other non-instructional time.
                </p>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addBreak}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Break
              </Button>
            </div>

            <div className="space-y-3">
              {currentMatrix.breaks.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 lg:flex-row lg:items-center"
                >
                  <div className="flex flex-1 items-center gap-2">
                    <Coffee className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <Input
                      value={item.name}
                      onChange={(event) =>
                        updateBreak(item.id, "name", event.target.value)
                      }
                      placeholder="Break name"
                      className="h-8 text-xs"
                    />
                  </div>

                  <Input
                    type="time"
                    value={item.startTime}
                    onChange={(event) =>
                      updateBreak(item.id, "startTime", event.target.value)
                    }
                    className="h-8 w-full text-xs lg:w-32"
                  />

                  <Input
                    type="time"
                    value={item.endTime}
                    onChange={(event) =>
                      updateBreak(item.id, "endTime", event.target.value)
                    }
                    className="h-8 w-full text-xs lg:w-32"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeBreak(item.id)}
                    className="text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-5 border-t pt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Step 4
                </p>
                <h2 className="mt-1 text-base font-semibold">
                  Subject and Faculty Allocation
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Link each subject to a responsible teacher.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSubject}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Assignment
              </Button>
            </div>

            <div className="space-y-3">
              {currentMatrix.subjects.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 lg:flex-row lg:items-center"
                >
                  <div className="flex flex-1 items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <Input
                      value={item.subjectName}
                      onChange={(event) =>
                        updateSubject(
                          item.id,
                          "subjectName",
                          event.target.value
                        )
                      }
                      placeholder="Subject name"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex flex-1 items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <select
                      value={item.teacherName}
                      onChange={(event) =>
                        updateSubject(
                          item.id,
                          "teacherName",
                          event.target.value
                        )
                      }
                      className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="">Select Teacher</option>
                      {AVAILABLE_TEACHERS.map((teacher) => (
                        <option key={teacher} value={teacher}>
                          {teacher}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubject(item.id)}
                    className="text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end border-t pt-6">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[220px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Timetable...
                </>
              ) : (
                "Save Timetable Framework"
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}