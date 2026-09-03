"use client"

import * as React from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import type { TeacherOverviewRow } from "@/components/teacher-overview-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface TeacherOverviewCardsProps {
  rows: TeacherOverviewRow[]
}

/** Mobile (below-lg) teacher overview registry: card list + detail sheet. */
export function TeacherOverviewCards({ rows }: TeacherOverviewCardsProps) {
  const { user } = useAuth()
  const canWrite = user?.role === "ADMIN" || user?.role === "STAFF"

  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.facultyMeta,
        meta: (
          <>
            {row.id} · {row.department}
          </>
        ),
        chips: [row.status, row.salaryStatus],
        sheetTitle: row.facultyMeta,
        sheetDescription: `${row.id} · ${row.department}`,
        sheetRows: [
          { label: "Teacher ID", value: row.id },
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
            label: "Mobile",
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
          { label: "Core Designation", value: row.subject },
          { label: "Employment Type", value: row.employmentType },
          { label: "Experience", value: row.yearsOfExperience },
          { label: "Prior Institution", value: row.formerSchool },
          { label: "Salary Status", value: row.salaryStatus },
          { label: "Status", value: row.status },
        ],
        sheetFooter:
          canWrite && row.internalId ? (
            <div className="py-1">
              <Link
                href={`/teachers/${encodeURIComponent(String(row.internalId))}/edit`}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900/50"
              >
                Edit teacher
              </Link>
            </div>
          ) : undefined,
      })),
    [rows, canWrite]
  )

  return (
    <MobileCardList
      rows={items}
      emptyMessage="No teacher overview records found."
    />
  )
}
