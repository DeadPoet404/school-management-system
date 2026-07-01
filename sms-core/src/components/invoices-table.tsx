"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  UniversalDataTable,
  DataTableColumn,
} from "@/components/universal-data-table"

export type Invoice = {
  id: string
  studentId: string
  feeCategory: string
  totalAmount: number
  paidAmount: number
  status: "Paid" | "Partial" | "Overdue"
  issueDate: string
  dueDate: string
}

const mockInvoices: Invoice[] = [
  {
    id: "INV-2026-001",
    studentId: "UCC-CS-2024-042",
    feeCategory: "Tuition & Core Academic",
    totalAmount: 4500.00,
    paidAmount: 4500.00,
    status: "Paid",
    issueDate: "2026-01-10",
    dueDate: "2026-02-28",
  },
  {
    id: "INV-2026-002",
    studentId: "UCC-CS-2025-115",
    feeCategory: "Laboratory & IT Infrastructure",
    totalAmount: 1200.00,
    paidAmount: 400.00,
    status: "Partial",
    issueDate: "2026-01-12",
    dueDate: "2026-03-15",
  },
  {
    id: "INV-2026-003",
    studentId: "UCC-MATH-2023-089",
    feeCategory: "Tuition & Core Academic",
    totalAmount: 4500.00,
    paidAmount: 0.00,
    status: "Overdue",
    issueDate: "2025-12-05",
    dueDate: "2026-01-30",
  },
  {
    id: "INV-2026-004",
    studentId: "UCC-SCI-2025-021",
    feeCategory: "Medical & Health Services",
    totalAmount: 650.00,
    paidAmount: 650.00,
    status: "Paid",
    issueDate: "2026-01-15",
    dueDate: "2026-02-28",
  },
  {
    id: "INV-2026-005",
    studentId: "UCC-OPS-2024-302",
    feeCategory: "Sports & Extra-Curricular",
    totalAmount: 850.00,
    paidAmount: 350.00,
    status: "Partial",
    issueDate: "2026-02-01",
    dueDate: "2026-04-01",
  }
]

export function InvoicesTable() {
  const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
  const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
  const redBadge = "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"

  const currencyFormatter = (amount: number) => {
    return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: "id",
      header: "Invoice ID",
      className: "w-[130px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
    },
    {
      key: "studentId",
      header: "Student ID",
      className: "w-[140px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
    },
    {
      key: "feeCategory",
      header: "Fee Category",
      className: "min-w-[180px]",
      cellClassName: "text-zinc-900 dark:text-zinc-100 font-medium text-sm",
    },
    {
      key: "totalAmount",
      header: "Total",
      className: "w-[120px] text-right",
      cellClassName: "font-mono text-right text-sm text-zinc-900 dark:text-zinc-100",
      cell: (row) => currencyFormatter(row.totalAmount),
    },
    {
      key: "paidAmount",
      header: "Paid",
      className: "w-[120px] text-right",
      cellClassName: "font-mono text-right text-sm text-emerald-600 dark:text-emerald-400",
      cell: (row) => currencyFormatter(row.paidAmount),
    },
    {
      key: "balance",
      header: "Balance",
      className: "w-[120px] text-right",
      cellClassName: "font-mono text-right text-sm",
      cell: (row) => {
        const balance = row.totalAmount - row.paidAmount
        return (
          <span className={balance > 0 ? "text-rose-600 dark:text-rose-400 font-medium" : "text-zinc-400 dark:text-zinc-500"}>
            {balance > 0 ? currencyFormatter(balance) : "Settled"}
          </span>
        )
      },
    },
    {
      key: "status",
      header: "Status",
      className: "w-[100px]",
      cell: (row) => {
        let statusStyle = greenBadge
        if (row.status === "Partial") statusStyle = amberBadge
        if (row.status === "Overdue") statusStyle = redBadge

        return (
          <Badge variant="outline" className={`font-medium tracking-wide shadow-none ${statusStyle}`}>
            {row.status}
          </Badge>
        )
      },
    },
    {
      key: "issueDate",
      header: "Issue Date",
      className: "w-[120px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
      cell: (row) => new Date(row.issueDate).toLocaleDateString(),
    },
    {   
      key: "dueDate",
      header: "Due Date",
      className: "w-[120px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
      cell: (row) => new Date(row.dueDate).toLocaleDateString(),
    },
  ]

  return (
    <div className="w-full pt-2">
      <UniversalDataTable
        data={mockInvoices}
        columns={columns}
        rowId={(invoice) => invoice.id}
        emptyMessage="No financial invoice statements found."
      />
    </div>
  )
}