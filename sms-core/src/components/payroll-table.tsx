"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  UniversalDataTable,
  DataTableColumn,
} from "@/components/universal-data-table"

export type PayrollRecord = {
  id: string
  staffName: string
  baseSalary: number
  allowances: number
  deductions: number
  payPeriod: string
  status: "Paid" | "Processing" | "On_Hold"
}

const mockPayroll: PayrollRecord[] = [
  {
    id: "PAY-2026-05-01",
    staffName: "Dr. Emmanuel Asamoah",
    baseSalary: 8500.00,
    allowances: 1200.00,
    deductions: 450.00,
    payPeriod: "May 2026",
    status: "Paid",
  },
  {
    id: "PAY-2026-05-02",
    staffName: "Prof. Cynthia Mensah",
    baseSalary: 11000.00,
    allowances: 1800.00,
    deductions: 620.00,
    payPeriod: "May 2026",
    status: "Paid",
  },
  {
    id: "PAY-2026-05-03",
    staffName: "Michael Owusu Boateng",
    baseSalary: 4200.00,
    allowances: 350.00,
    deductions: 180.00,
    payPeriod: "May 2026",
    status: "Processing",
  },
  {
    id: "PAY-2026-05-04",
    staffName: "Abigail Naa Darko",
    baseSalary: 5100.00,
    allowances: 500.00,
    deductions: 220.00,
    payPeriod: "May 2026",
    status: "On_Hold",
  },
  {
    id: "PAY-2026-05-05",
    staffName: "Kwame Appiah Nkrumah",
    baseSalary: 3800.00,
    allowances: 200.00,
    deductions: 110.00,
    payPeriod: "May 2026",
    status: "Processing",
  }
]

export function PayrollTable() {
  const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
  const blueBadge = "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60"
  const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"

  const currencyFormatter = (amount: number) => {
    return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const columns: DataTableColumn<PayrollRecord>[] = [
    {
      key: "id",
      header: "Payroll ID",
      className: "w-[140px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
    },
    {
      key: "staffName",
      header: "Staff Member",
      className: "min-w-[180px]",
      cellClassName: "text-zinc-900 dark:text-zinc-100 font-medium text-sm",
    },
    {
      key: "baseSalary",
      header: "Base Salary",
      className: "w-[120px] text-right",
      cellClassName: "font-mono text-right text-sm text-zinc-600 dark:text-zinc-400",
      cell: (row) => currencyFormatter(row.baseSalary),
    },
    {
      key: "allowances",
      header: "Allowances",
      className: "w-[120px] text-right",
      cellClassName: "font-mono text-right text-sm text-emerald-600 dark:text-emerald-400",
      cell: (row) => currencyFormatter(row.allowances),
    },
    {
      key: "deductions",
      header: "Deductions",
      className: "w-[120px] text-right",
      cellClassName: "font-mono text-right text-sm text-rose-600 dark:text-rose-400",
      cell: (row) => currencyFormatter(row.deductions),
    },
    {
      key: "netPay",
      header: "Net Distribution",
      className: "w-[140px] text-right",
      cellClassName: "font-mono text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100",
      cell: (row) => {
        const net = row.baseSalary + row.allowances - row.deductions
        return currencyFormatter(net)
      },
    },
    {
      key: "payPeriod",
      header: "Pay Period",
      className: "w-[120px]",
      cellClassName: "font-medium text-zinc-500 dark:text-zinc-400 text-xs",
    },
    {
      key: "status",
      header: "Disbursement Status",
      className: "w-[120px]",
      cell: (row) => {
        let statusStyle = greenBadge
        let displayLabel = "Paid"

        if (row.status === "Processing") {
          statusStyle = blueBadge
          displayLabel = "Processing"
        } else if (row.status === "On_Hold") {
          statusStyle = amberBadge
          displayLabel = "On Hold"
        }

        return (
          <Badge variant="outline" className={`font-medium tracking-wide shadow-none ${statusStyle}`}>
            {displayLabel}
          </Badge>
        )
      },
    },
  ]

  return (
    <div className="w-full pt-2">
      <UniversalDataTable
        data={mockPayroll}
        columns={columns}
        rowId={(record) => record.id}
        emptyMessage="No organizational payroll allocations found for this ledger period."
      />
    </div>
  )
}