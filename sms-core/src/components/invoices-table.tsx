"use client"

import * as React from "react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  UniversalDataTable,
  DataTableColumn,
} from "@/components/universal-data-table"
import { useInvoices } from "@/lib/api/finance"
import { Skeleton } from "@/components/ui/skeleton"

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

const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
const redBadge = "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"

const currencyFormatter = (amount: number) => {
  return "GH₥" + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const columns: DataTableColumn<Invoice>[] = [
  { key: "id", header: "Invoice ID", className: "w-[130px]", cellClassName: "font-mono text-xs text-muted-foreground" },
  { key: "studentId", header: "Student ID", className: "w-[140px]", cellClassName: "font-mono text-xs text-muted-foreground" },
  { key: "feeCategory", header: "Fee Category", className: "min-w-[180px]", cellClassName: "text-zinc-900 dark:text-zinc-100 font-medium text-sm" },
  { key: "totalAmount", header: "Total", className: "w-[120px] text-right", cellClassName: "font-mono text-right text-sm text-zinc-900 dark:text-zinc-100", cell: (row: Invoice) => currencyFormatter(row.totalAmount) },
  { key: "paidAmount", header: "Paid", className: "w-[120px] text-right", cellClassName: "font-mono text-right text-sm text-emerald-600 dark:text-emerald-400", cell: (row: Invoice) => currencyFormatter(row.paidAmount) },
  {
    key: "balance", header: "Balance", className: "w-[120px] text-right", cellClassName: "font-mono text-right text-sm",
    cell: (row: Invoice) => {
      const balance = row.totalAmount - row.paidAmount
      return (<span className={balance > 0 ? "text-rose-600 dark:text-rose-400 font-medium" : "text-zinc-400 dark:text-zinc-500"}>{balance > 0 ? currencyFormatter(balance) : "Settled"}</span>)
    },
  },
  {
    key: "status", header: "Status", className: "w-[100px]",
    cell: (row: Invoice) => {
      let statusStyle = greenBadge
      if (row.status === "Partial") statusStyle = amberBadge
      if (row.status === "Overdue") statusStyle = redBadge
      return (<Badge variant="outline" className={"font-medium tracking-wide shadow-none " + statusStyle}>{row.status}</Badge>)
    },
  },
  { key: "issueDate", header: "Issue Date", className: "w-[120px]", cellClassName: "font-mono text-xs text-muted-foreground", cell: (row: Invoice) => new Date(row.issueDate).toLocaleDateString() },
  { key: "dueDate", header: "Due Date", className: "w-[120px]", cellClassName: "font-mono text-xs text-muted-foreground", cell: (row: Invoice) => new Date(row.dueDate).toLocaleDateString() },
]

function InvoicesTableSkeleton() {
  return (
    <div className="w-full pt-2 space-y-3">
      <div className="rounded-md border border-zinc-200 bg-card overflow-hidden dark:border-zinc-800">
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 h-10" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 flex items-center h-12 px-4 gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function InvoicesTable() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useInvoices(page, 20)

  if (isLoading) return <InvoicesTableSkeleton />

  if (isError) {
    return (
      <div className="w-full pt-2">
        <UniversalDataTable data={[]} columns={columns} rowId={(invoice: Invoice) => invoice.id} emptyMessage="Failed to load invoices. Check your connection and try again." />
      </div>
    )
  }

  return (
    <div className="w-full pt-2">
      <UniversalDataTable data={data?.data ?? []} columns={columns} rowId={(invoice: Invoice) => invoice.id} emptyMessage="No financial invoice statements found." pagination={data?.pagination} onPageChange={setPage} />
    </div>
  )
}
