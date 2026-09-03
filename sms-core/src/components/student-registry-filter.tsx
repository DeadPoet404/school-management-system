"use client"

import * as React from "react"
import {
  DynamicFilterPopover,
  type FilterField,
  type FilterOption,
} from "@/components/dynamic-filter-popover"

export type StudentClassFilterOption = {
  id: string
  name: string
  section?: string | null
}

interface StudentRegistryFilterProps {
  activeFilterCount: number
  classes: StudentClassFilterOption[]
  onApplyFilters: (
    filters: Record<string, string>
  ) => void
}

const STATUS_OPTIONS: FilterOption[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Departed", value: "DEPARTED" },
]

const GENDER_OPTIONS: FilterOption[] = [
  { label: "Female", value: "FEMALE" },
  { label: "Male", value: "MALE" },
]

const BOARDING_OPTIONS: FilterOption[] = [
  { label: "Day student", value: "DAY" },
  { label: "Boarding student", value: "BOARDING" },
]

export function StudentRegistryFilter({
  activeFilterCount,
  classes,
  onApplyFilters,
}: StudentRegistryFilterProps) {
  const fields = React.useMemo<FilterField[]>(
    () => [
      {
        id: "status",
        label: "Student status",
        type: "checkbox-group",
        options: STATUS_OPTIONS,
      },
      {
        id: "classId",
        label: "Class",
        type: "combobox",
        placeholder: "Select a school class...",
        options: classes.map((item) => ({
          label: item.section
            ? `${item.name} — ${item.section}`
            : item.name,
          value: item.id,
        })),
      },
      {
        id: "gender",
        label: "Gender",
        type: "combobox",
        placeholder: "Select gender...",
        options: GENDER_OPTIONS,
      },
      {
        id: "boardingStatus",
        label: "Student type",
        type: "combobox",
        placeholder: "Select day or boarding...",
        options: BOARDING_OPTIONS,
      },
      {
        id: "minGpa",
        label: "Minimum GPA",
        type: "number",
        min: 0,
        max: 4,
        placeholder: "For example, 2.5",
      },
      {
        id: "minAttendance",
        label: "Minimum attendance (%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "For example, 80",
      },
    ],
    [classes]
  )

  const handleApply = (
    appliedValues: Record<string, unknown>
  ) => {
    const processedFilters = Object.fromEntries(
      Object.entries(appliedValues)
        .filter(([, value]) =>
          typeof value === "string" &&
          value.trim() !== ""
        )
        .map(([key, value]) => [
          key,
          String(value).trim(),
        ])
    )

    onApplyFilters(processedFilters)
  }

  return (
    <DynamicFilterPopover
      fields={fields}
      onApplyFilters={handleApply}
      triggerLabel={
        activeFilterCount > 0
          ? String(activeFilterCount)
          : ""
      }
      className="h-11 w-11 lg:h-9 lg:w-9 border-0 bg-transparent p-0 hover:bg-zinc-100 data-[state=open]:bg-zinc-100 dark:hover:bg-zinc-900 dark:data-[state=open]:bg-zinc-900"
      align="end"
    />
  )
}
