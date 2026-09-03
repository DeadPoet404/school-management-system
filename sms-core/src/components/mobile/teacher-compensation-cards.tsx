"use client"

import * as React from "react"
import type { FacultyPayrollRow } from "@/components/faculty-payroll-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface TeacherCompensationCardsProps {
  rows: FacultyPayrollRow[]
}

const PAYOUT_GREEN =
  "font-mono text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400"

/** Mobile (below-lg) teacher compensation registry — net pay leads the card. */
export function TeacherCompensationCards({
  rows,
}: TeacherCompensationCardsProps) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.name,
        meta: row.id,
        chips: [row.payoutStatus],
        trailing:
          row.netPay !== "—" ? (
            <span className={PAYOUT_GREEN}>{row.netPay}</span>
          ) : undefined,
        sheetTitle: row.name,
        sheetDescription: `${row.id} · Compensation record`,
        sheetRows: [
          { label: "Teacher ID", value: row.id },
          { label: "Base Salary", value: row.baseSalary },
          { label: "Deductions", value: row.deductions },
          {
            label: "Net Payout",
            value: (
              <span className="font-mono text-base font-semibold text-emerald-600 dark:text-emerald-400">
                {row.netPay}
              </span>
            ),
          },
          { label: "Disbursement Route", value: row.accountRouting },
          { label: "Payout State", value: row.payoutStatus },
        ],
      })),
    [rows]
  )

  return (
    <MobileCardList
      rows={items}
      emptyMessage="No compensation schedules found."
    />
  )
}
