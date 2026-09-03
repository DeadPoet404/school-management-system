"use client"

import * as React from "react"
import type { StaffPayrollRow } from "@/components/staff-payroll-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface StaffPayrollCardsProps {
  rows: StaffPayrollRow[]
}

const SALARY_GREEN =
  "font-mono text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400"

/** Mobile (below-lg) staff payroll registry — base salary leads the card. */
export function StaffPayrollCards({ rows }: StaffPayrollCardsProps) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.name,
        meta: row.id,
        chips: [row.payrollStatus],
        trailing:
          row.baseSalary !== "—" ? (
            <span className={SALARY_GREEN}>{row.baseSalary}</span>
          ) : undefined,
        sheetTitle: row.name,
        sheetDescription: `${row.id} · Financial accounts & payroll`,
        sheetRows: [
          { label: "Staff ID", value: row.id },
          { label: "Clearance Tier", value: row.clearanceTier },
          {
            label: "Base Salary",
            value: (
              <span className="font-mono text-base font-semibold text-emerald-600 dark:text-emerald-400">
                {row.baseSalary}
              </span>
            ),
          },
          { label: "Bank / Account", value: row.bankRouting },
          { label: "Payout State", value: row.payrollStatus },
        ],
      })),
    [rows]
  )

  return (
    <MobileCardList
      rows={items}
      emptyMessage="No payroll records found."
    />
  )
}
