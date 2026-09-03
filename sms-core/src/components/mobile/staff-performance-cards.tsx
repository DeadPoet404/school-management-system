"use client"

import * as React from "react"
import type { StaffWorkforceRow } from "@/components/staff-workforce-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface StaffPerformanceCardsProps {
  rows: StaffWorkforceRow[]
}

/** Mobile (below-lg) staff performance registry: score pills lead the card. */
export function StaffPerformanceCards({
  rows,
}: StaffPerformanceCardsProps) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.name,
        meta: (
          <>
            {row.id} · {row.department}
          </>
        ),
        chips: [
          row.reviewStatus,
          row.performanceScore,
          row.complianceScore,
        ],
        sheetTitle: row.name,
        sheetDescription: `${row.id} · ${row.jobTitle}`,
        sheetRows: [
          { label: "Staff ID", value: row.id },
          { label: "Job Title", value: row.jobTitle },
          { label: "Department", value: row.department },
          {
            label: "Profile Completeness",
            value: row.profileCompleteness,
          },
          { label: "Compliance Score", value: row.complianceScore },
          { label: "Payroll Readiness", value: row.payrollReadiness },
          { label: "Performance Score", value: row.performanceScore },
          { label: "Review Status", value: row.reviewStatus },
          { label: "Metric Coverage", value: row.metricCoverage },
        ],
      })),
    [rows]
  )

  return (
    <MobileCardList
      rows={items}
      emptyMessage="No staff performance metrics found."
    />
  )
}
