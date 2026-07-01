"use client"

import * as React from "react"
import { DynamicFilterPopover, type FilterField } from "@/components/dynamic-filter-popover"

// --- Domain Vocabulary Mappings for Faculty & Academic Staff ---
const TEACHER_STATUS_OPTIONS = ["Active", "On Leave", "Probationary", "Suspended"] as const
const EMPLOYMENT_TYPE_OPTIONS = ["Permanent Full-Time", "Part-Time Associate", "Contract Consultant"] as const

const DEPARTMENT_OPTIONS = [
  "Mathematics & Statistics",
  "Pure & Applied Sciences",
  "Languages & Linguistics",
  "Humanities & Social Arts",
  "Business & Financial Studies",
  "Vocational & Technical"
] as const

// --- Schema Definitions for Faculty Advanced Search Architecture ---
const teacherFilterFields: FilterField[] = [
  {
    id: "employmentStatus",
    label: "Employment / Lifecycle Status",
    type: "checkbox-group",
    options: TEACHER_STATUS_OPTIONS,
  },
  {
    id: "employmentType",
    label: "Contract Framework Classification",
    type: "combobox",
    placeholder: "Select contract framework...",
    options: EMPLOYMENT_TYPE_OPTIONS,
  },
  {
    id: "department",
    label: "Academic Department Allocation",
    type: "combobox",
    placeholder: "Select primary department...",
    options: DEPARTMENT_OPTIONS,
  },
  {
    id: "minExperience",
    label: "Academic Experience Floor (Years)",
    type: "number",
    min: 0,
    placeholder: "Show teachers with experience $\ge$ ...",
  },
]

interface TeacherRegistryFilterProps {
  onApplyFilters: (filters: Record<string, any>) => void
}

export function TeacherRegistryFilter({ onApplyFilters }: TeacherRegistryFilterProps) {
  const handleApply = (appliedValues: Record<string, any>) => {
    // Normalizes empty string allocations before lifting criteria back up to parent components
    const processedFilters = Object.fromEntries(
      Object.entries(appliedValues).filter(([_, val]) => val !== "" && val !== null)
    )
    
    console.log("Teacher registry criteria executed:", processedFilters)
    onApplyFilters(processedFilters)
  }

  return (
    <DynamicFilterPopover
      fields={teacherFilterFields}
      onApplyFilters={handleApply}
      triggerLabel=""
      className="border-0 w-9 p-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-900"
      align="end"
    />
  )
}