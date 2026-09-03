"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StudentFinancialRow } from "@/components/student-financial-table"
import {
  MobileDetailSheet,
  type MobileSheetRow,
} from "@/components/mobile/mobile-detail-sheet"

interface StudentFinancialCardsProps {
  rows: StudentFinancialRow[]
}

const typeChipClass = (paymentType: string) =>
  paymentType === "Invoice"
    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
    : paymentType === "—"
      ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"

/**
 * Mobile (below lg) rendering of the student financial registry. The card
 * leads with the running balance (the operator's most frequent glance),
 * then the last ledger movement. Tapping opens a bottom sheet with the
 * full last-transaction record.
 */
export function StudentFinancialCards({ rows }: StudentFinancialCardsProps) {
  const [selected, setSelected] = React.useState<StudentFinancialRow | null>(
    null
  )

  const detailRows: MobileSheetRow[] = selected
    ? [
        { label: "Student ID", value: selected.id },
        { label: "Last Transaction ID", value: selected.lastTransactionId },
        {
          label: "Transaction Date",
          value: selected.lastTransactionDate,
        },
        {
          label: "Type",
          value: (
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                typeChipClass(selected.paymentType)
              )}
            >
              {selected.paymentType}
            </span>
          ),
        },
        { label: "Amount Paid", value: selected.amountPaid },
        {
          label: "Balance Owed",
          value: selected.balanceRemaining,
        },
      ]
    : []

  return (
    <>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center px-6 text-center text-xs text-zinc-400">
          No financial records found.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {rows.map((row, index) => (
            <li key={`${row.id}-${index}`}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="flex min-h-[72px] w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/40 dark:active:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {row.studentMeta}
                    </p>
                    {row.status}
                  </div>

                  <p className="mt-1 truncate font-mono text-xs tracking-wide text-zinc-400 dark:text-zinc-500">
                    {row.id}
                    {row.lastTransactionDate !== "—"
                      ? ` · last ${row.lastTransactionDate}`
                      : ""}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {row.paymentType !== "—" ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          typeChipClass(row.paymentType)
                        )}
                      >
                        {row.paymentType}
                      </span>
                    ) : null}
                    {row.amountPaid !== "—" ? (
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        Paid {row.amountPaid}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[15px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                    {row.balanceRemaining}
                  </span>
                  <ChevronRight className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                </div>
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
        title={selected ? selected.studentMeta : ""}
        description={selected ? `${selected.id} · Financial ledger` : undefined}
        rows={detailRows}
      />
    </>
  )
}
