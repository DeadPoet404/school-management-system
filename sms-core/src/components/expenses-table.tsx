"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  UniversalDataTable,
  DataTableColumn,
} from "@/components/universal-data-table"

export type Expense = {
  id: string
  vendorName: string
  category: string
  description: string
  amount: number
  paymentMethod: string
  status: "Cleared" | "Pending_Approval" | "Rejected"
  expenseDate: string
}

const mockExpenses: Expense[] = [
  {
    id: "EXP-2026-101",
    vendorName: "Academic Books Distribution Ltd",
    category: "Learning Resources",
    description: "Purchase of core library reference textbooks for WASSCE preparation tracks.",
    amount: 12450.00,
    paymentMethod: "Bank Cheque",
    status: "Cleared",
    expenseDate: "2026-05-14",
  },
  {
    id: "EXP-2026-102",
    vendorName: "Electricity Company of Ghana (ECG)",
    category: "Utilities",
    description: "Monthly commercial energy tariff settlement for campus main block and server rooms.",
    amount: 4200.00,
    paymentMethod: "Mobile Money (MoMo)",
    status: "Pending_Approval",
    expenseDate: "2026-06-18",
  },
  {
    id: "EXP-2026-103",
    vendorName: "Star Assurance Ghana",
    category: "Insurance & Risk",
    description: "Annual liability premium renewal for school transport fleets and structural property.",
    amount: 8900.00,
    paymentMethod: "Bank Wire Transfer",
    status: "Cleared",
    expenseDate: "2026-04-20",
  },
  {
    id: "EXP-2026-104",
    vendorName: "Ghana Water Company Ltd",
    category: "Utilities",
    description: "Water supply billing dispute adjustment for student residential quarters.",
    amount: 1850.00,
    paymentMethod: "Cash Settlement",
    status: "Rejected",
    expenseDate: "2026-06-02",
  },
  {
    id: "EXP-2026-105",
    vendorName: "Zoomlion Logistics",
    category: "Sanitation & Facilities",
    description: "Bi-weekly community waste management routing and general campus estate cleanup.",
    amount: 3100.00,
    paymentMethod: "Mobile Money (MoMo)",
    status: "Pending_Approval",
    expenseDate: "2026-06-19",
  }
]

export function ExpensesTable() {
  const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
  const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
  const redBadge = "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"

  const currencyFormatter = (amount: number) => {
    return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const columns: DataTableColumn<Expense>[] = [
    {
      key: "id",
      header: "Expense ID",
      className: "w-[130px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
    },
    {
      key: "vendorName",
      header: "Payee / Vendor",
      className: "min-w-[160px]",
      cellClassName: "text-zinc-900 dark:text-zinc-100 font-medium text-sm",
    },
    {
      key: "category",
      header: "Category Allocation",
      className: "w-[150px]",
      cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs font-medium",
    },
    {
      key: "description",
      header: "Audit Line Description",
      className: "min-w-[240px] max-w-[340px]",
      cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs truncate",
    },
    {
      key: "amount",
      header: "Total Outflow",
      className: "w-[130px] text-right",
      cellClassName: "font-mono text-right text-sm text-zinc-900 dark:text-zinc-100 font-medium",
      cell: (row) => currencyFormatter(row.amount),
    },
    {
      key: "paymentMethod",
      header: "Payment Channel",
      className: "w-[150px]",
      cellClassName: "text-zinc-600 dark:text-zinc-300 text-xs font-medium",
    },
    {
      key: "status",
      header: "Approval State",
      className: "w-[140px]",
      cell: (row) => {
        let statusStyle = greenBadge
        let displayLabel = "Cleared"

        if (row.status === "Pending_Approval") {
          statusStyle = amberBadge
          displayLabel = "Pending Approval"
        } else if (row.status === "Rejected") {
          statusStyle = redBadge
          displayLabel = "Rejected"
        }

        return (
          <Badge variant="outline" className={`font-medium tracking-wide shadow-none ${statusStyle}`}>
            {displayLabel}
          </Badge>
        )
      },
    },
    {
      key: "expenseDate",
      header: "Posting Date",
      className: "w-[120px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
      cell: (row) => new Date(row.expenseDate).toLocaleDateString(),
    },
  ]

  return (
    <div className="w-full pt-2">
      <UniversalDataTable
        data={mockExpenses}
        columns={columns}
        rowId={(expense) => expense.id}
        emptyMessage="No operational expenditure accounts matched this filter set."
      />
    </div>
  )
}