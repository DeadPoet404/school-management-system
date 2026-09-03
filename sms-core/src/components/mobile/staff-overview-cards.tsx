"use client"

import * as React from "react"
import type { StaffOverviewRow } from "@/components/staff-overview-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface StaffOverviewCardsProps {
  rows: StaffOverviewRow[]
}

/** Mobile (below-lg) staff overview registry: card list + detail sheet. */
export function StaffOverviewCards({ rows }: StaffOverviewCardsProps) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.staffMeta,
        meta: (
          <>
            {row.id} · {row.department}
          </>
        ),
        chips: [row.status, row.salaryStatus],
        sheetTitle: row.staffMeta,
        sheetDescription: `${row.id} · ${row.department} · ${row.jobTitle}`,
        sheetRows: [
          { label: "Staff ID", value: row.id },
          {
            label: "Email",
            value:
              row.email !== "N/A" ? (
                <a
                  href={`mailto:${row.email}`}
                  className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 break-all dark:text-blue-400"
                >
                  {row.email}
                </a>
              ) : (
                "N/A"
              ),
          },
          {
            label: "Mobile Phone",
            value:
              row.phone !== "—" ? (
                <a
                  href={`tel:${row.phone.replace(/[^+\d]/g, "")}`}
                  className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
                >
                  {row.phone}
                </a>
              ) : (
                "—"
              ),
          },
          { label: "Job Title", value: row.jobTitle },
          { label: "Employment Type", value: row.employmentType },
          { label: "Shift Schedule", value: row.shiftSchedule },
          { label: "Prior Institution", value: row.priorInstitution },
          { label: "Salary Status", value: row.salaryStatus },
          { label: "Status", value: row.status },
        ],
      })),
    [rows]
  )

  return (
    <MobileCardList
      rows={items}
      emptyMessage="No staff overview records found."
    />
  )
}
