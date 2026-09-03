"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { StudentOverviewRow } from "@/components/student-overview-table"
import {
  MobileDetailSheet,
  type MobileSheetRow,
} from "@/components/mobile/mobile-detail-sheet"

const feesChipClass: Record<string, string> = {
  Paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400",
  Partial:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400",
  Unpaid:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400",
}

const feesChipFor = (status: string) =>
  feesChipClass[status] ?? feesChipClass.Unpaid

const statusChipClass = (status: string) =>
  status.toLowerCase() === "active"
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"

interface StudentOverviewCardsProps {
  rows: StudentOverviewRow[]
  /** Mirror of the parent's write permission so destructive/primary links can be gated. */
  canWrite: boolean
}

/**
 * Mobile (below lg) rendering of the student overview registry.
 *
 * Design contract (mobile map, P1):
 * - the row card is a *core summary*: name, ID, class, status + fee chips
 * - tapping opens a bottom-anchored detail sheet with the full record
 * - primary actions are full-width, ≥44px tall targets; the icon cluster
 *   (reset password / transcript) reuses the desktop row nodes but is given
 *   a larger hit area via min-size overrides
 */
export function StudentOverviewCards({
  rows,
  canWrite,
}: StudentOverviewCardsProps) {
  const [selected, setSelected] = React.useState<StudentOverviewRow | null>(
    null
  )

  const detailRows: MobileSheetRow[] = selected
    ? [
        {
          label: "Student ID",
          value: (
            <span className="font-mono text-[13px] tracking-wide">
              {selected.id}
            </span>
          ),
        },
        { label: "Gender", value: selected.gender },
        { label: "Class", value: selected.class },
        { label: "Parent / Guardian", value: selected.parentName },
        {
          label: "Parent Contact",
          value: selected.parentContact.startsWith("+") ||
            selected.parentContact.startsWith("0") ? (
            <a
              href={`tel:${selected.parentContact.replace(/[^+\d]/g, "")}`}
              className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
            >
              {selected.parentContact}
            </a>
          ) : (
            selected.parentContact
          ),
        },
        { label: "GPA", value: selected.gpa },
        { label: "Attendance", value: selected.attendanceRate },
        { label: "Enrollment Date", value: selected.enrollmentDate },
        {
          label: "Status",
          value: (
            <span
              className={cn(
                "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
                statusChipClass(selected.status)
              )}
            >
              {selected.status}
            </span>
          ),
        },
        {
          label: "Fees Status",
          value: (
            <span
              className={cn(
                "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
                feesChipFor(selected.feesStatus)
              )}
            >
              {selected.feesStatus}
            </span>
          ),
        },
      ]
    : []

  const canShowActions =
    !!selected &&
    selected.actions !== undefined &&
    typeof selected.actions !== "string"

  return (
    <>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center px-6 text-center text-xs text-zinc-400">
          No student overview records found.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {rows.map((row, index) => (
            <li key={`${row.id}-${index}`}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                aria-label={`View details for ${row.studentName} (${row.id})`}
                className="flex min-h-[64px] w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/40 dark:active:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {row.studentName}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
                        statusChipClass(row.status)
                      )}
                    >
                      {row.status}
                    </span>
                  </div>

                  <p className="mt-1 truncate font-mono text-xs tracking-wide text-zinc-400 dark:text-zinc-500">
                    {row.id} · {row.class}
                  </p>

                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                        feesChipFor(row.feesStatus)
                      )}
                    >
                      Fees: {row.feesStatus}
                    </span>
                    {row.gender !== "—" ? (
                      <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
                        {row.gender}
                      </span>
                    ) : null}
                    {row.attendanceRate !== "—" ? (
                      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                        {row.attendanceRate} attendance
                      </span>
                    ) : null}
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <MobileDetailSheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={selected?.studentName ?? ""}
        description={
          selected
            ? `${selected.id} · ${selected.class}`
            : undefined
        }
        rows={detailRows}
        footer={
          selected ? (
            <div className="flex flex-col gap-3 py-1">
              <div className="grid grid-cols-1 gap-2">
                {selected.attendanceLink !== "—" &&
                typeof selected.attendanceLink !== "string" ? (
                  <Link
                    href={`/students/${encodeURIComponent(String(selected.internalId))}/attendance`}
                    className="inline-flex min-h-12 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    View attendance report
                  </Link>
                ) : null}

                {canWrite && selected.internalId ? (
                  <Link
                    href={`/students/${encodeURIComponent(String(selected.internalId))}/edit`}
                    className="inline-flex min-h-12 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900/50"
                  >
                    Edit student
                  </Link>
                ) : null}
              </div>

              {canShowActions ? (
                <div className="flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
                  <p className="text-[10px] font-bold tracking-[0.16em] text-zinc-400 uppercase dark:text-zinc-500">
                    Quick actions
                  </p>
                  <div className="flex items-center gap-2 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:min-w-11 [&_a]:items-center [&_a]:justify-center [&_button]:inline-flex [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:items-center [&_button]:justify-center">
                    {selected.actions}
                  </div>
                </div>
              ) : null}
            </div>
          ) : undefined
        }
      />
    </>
  )
}
