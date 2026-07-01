"use client"

import * as React from "react"
import { DynamicFilterPopover, type FilterField } from "@/components/dynamic-filter-popover"

// --- Domain Vocabulary Mappings for Student Cohorts ---
const STUDENT_STATUS_OPTIONS = ["Active", "Probation", "On Leave", "Graduated"] as const
const GRADE_LEVEL_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior"] as const

const DISCIPLINARY_TRACKS = [
  "Computer Science",
  "Data Science",
  "Cybersecurity",
  "Mechanical Eng.",
  "Business Analytics",
  "Biochemistry",
  "Digital Marketing",
  "Economics"
] as const

// --- Schema Definitions for Student Advanced Search Architecture ---
const studentFilterFields: FilterField[] = [
  {
    id: "academicStanding",
    label: "Academic Registry Standing",
    type: "checkbox-group",
    options: STUDENT_STATUS_OPTIONS,
  },
  {
    id: "gradeLevel",
    label: "Current Grade Level Cohort",
    type: "combobox",
    placeholder: "Select student cohort year...",
    options: GRADE_LEVEL_OPTIONS,
  },
  {
    id: "major",
    label: "Field of Study / Track",
    type: "combobox",
    placeholder: "Select academic major stream...",
    options: DISCIPLINARY_TRACKS,
  },
  {
    id: "minGpa",
    label: "Cumulative GPA Floor Limit",
    type: "number",
    min: "0.0",
    placeholder: "Show scores greater than or equal to (e.g. 3.0)",
  },
  {
    id: "minAttendance",
    label: "Minimum Attendance Threshold (%)",
    type: "number",
    min: 0,
    placeholder: "Filter by attendance percentage floor (e.g. 90)",
  }
]

interface StudentRegistryFilterProps {
  onApplyFilters: (filters: Record<string, any>) => void
}

export function StudentRegistryFilter({ onApplyFilters }: StudentRegistryFilterProps) {
  const handleApply = (appliedValues: Record<string, any>) => {
    // Normalizes empty string allocations before lifting criteria back up to parent components
    const processedFilters = Object.fromEntries(
      Object.entries(appliedValues).filter(([_, val]) => val !== "" && val !== null)
    )
    
    console.log("Student workspace criteria executed:", processedFilters)
    onApplyFilters(processedFilters)
  }

  return (
    <DynamicFilterPopover
      fields={studentFilterFields}
      onApplyFilters={handleApply}
      triggerLabel=""
      className="border-0 w-9 p-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-900"
      align="end"
    />
  )
}