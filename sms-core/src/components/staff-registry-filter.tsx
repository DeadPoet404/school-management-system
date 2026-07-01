"use client"

import * as React from "react"
import { DynamicFilterPopover, type FilterField } from "@/components/dynamic-filter-popover"

// --- Domain Vocabulary Mappings for Institutional Staff ---
const STAFF_STATUS_OPTIONS = ["Active", "On Leave", "Suspended", "Terminated"] as const
const EMPLOYMENT_TYPE_OPTIONS = ["Full-Time", "Part-Time", "Contract", "Visiting Faculty"] as const

const DEPLOYMENT_DEPARTMENTS = [
  "Administration & Registry",
  "Faculty of Computer Science",
  "Department of Mathematics",
  "Department of Natural Sciences",
  "Logistics & Operations Support"
] as const

// --- Schema Definitions for Staff Advanced Search Architecture ---
const staffFilterFields: FilterField[] = [
  {
    id: "employmentStatus",
    label: "Registry Deployment Status",
    type: "checkbox-group",
    options: STAFF_STATUS_OPTIONS,
  },
  {
    id: "employmentType",
    label: "Engagement Classification",
    type: "combobox",
    placeholder: "Select placement type...",
    options: EMPLOYMENT_TYPE_OPTIONS,
  },
  {
    id: "department",
    label: "Cost Center / Department Allocation",
    type: "combobox",
    placeholder: "Select deployment branch...",
    options: DEPLOYMENT_DEPARTMENTS,
  },
  {
    id: "minExperience",
    label: "Minimum Tenure Profile (Years)",
    type: "number",
    min: 0,
    placeholder: "Filter by institutional lifecycle duration...",
  },
]

interface StaffRegistryFilterProps {
  onApplyFilters: (filters: Record<string, any>) => void
}

export function StaffRegistryFilter({ onApplyFilters }: StaffRegistryFilterProps) {
  const handleApply = (appliedValues: Record<string, any>) => {
    // Normalizes empty string allocations before lifting criteria back up to parent components
    const processedFilters = Object.fromEntries(
      Object.entries(appliedValues).filter(([_, val]) => val !== "" && val !== null)
    )
    
    console.log("Staff workspace criteria executed:", processedFilters)
    onApplyFilters(processedFilters)
  }

  return (
    <DynamicFilterPopover
      fields={staffFilterFields}
      onApplyFilters={handleApply}
      triggerLabel=""
      className="border-0 w-9 p-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-900"
      align="end"
    />
  )
}