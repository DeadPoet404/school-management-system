"use client"

import * as React from "react"
import type { FacultyLoadRow } from "@/components/faculty-load-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface TeacherAssignmentCardsProps {
  rows: FacultyLoadRow[]
}

/** Mobile (below-lg) teacher class/subject assignment registry. */
export function TeacherAssignmentCards({
  rows,
}: TeacherAssignmentCardsProps) {
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
        chips: [row.status],
        sheetTitle: row.name,
        sheetDescription: `${row.id} · Class & subject assignment`,
        sheetRows: [
          { label: "Teacher ID", value: row.id },
          { label: "Department", value: row.department },
          { label: "Assigned Subject", value: row.subjectLoad },
          { label: "Academic Track", value: row.academicTrack },
          { label: "Weekly Load", value: row.weeklyHours },
          { label: "Status", value: row.status },
        ],
      })),
    [rows]
  )

  return (
    <MobileCardList
      rows={items}
      emptyMessage="No teaching allocations found."
    />
  )
}
