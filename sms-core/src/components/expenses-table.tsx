"use client"

import * as React from "react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { UniversalDataTable, DataTableColumn } from "@/components/universal-data-table"
import { useExpenses } from "@/lib/api/finance"
import { Skeleton } from "@/components/ui/skeleton"

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

const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
const redBadge = "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"

const currencyFormatter = (amount: number) => {
  return "GH₥" + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const columns: DataTableColumn<Expense>[] = [
  { key: "id", header: "Expense ID", className: "w-[130px]", cellClassName: "font-mono text-xs text-muted-foreground" },
  { key: "vendorName", header: "Payee / Vendor", className: "min-w-[160px]", cellClassName: "text-zinc-900 dark:text-zinc-100 font-medium text-sm" },
  { key: "category", header: "Category Allocation", className: "w-[150px]", cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs font-medium" },
  { key: "description", header: "Audit Line Description", className: "min-w-[240px] max-w-[340px]", cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs truncate" },
  { key: "amount", header: "Total Outflow", className: "w-[130px] text-right", cellClassName: "font-mono text-right text-sm text-zinc-900 dark:text-zinc-100 font-medium", cell: (row: Expense) => currencyFormatter(row.amount) },
  { key: "paymentMethod", header: "Payment Channel", className: "w-[150px]", cellClassName: "text-zinc-600 dark:text-zinc-300 text-xs font-medium" },
  {
    key: "status", header: "Approval State", className: "w-[140px]",
    cell: (row: Expense) => {
      let statusStyle = greenBadge;
      let displayLabel = "Cleared";
      if (row.status === "Pending_Approval") { statusStyle = amberBadge; displayLabel = "Pending Approval"; }
      else if (row.status === "Rejected") { statusStyle = redBadge; displayLabel = "Rejected"; }
      return (<Badge variant="outline" className={"font-medium tracking-wide shadow-none " + statusStyle}>{displayLabel}</Badge>);
    },
  },
  { key: "expenseDate", header: "Posting Date", className: "w-[120px]", cellClassName: "font-mono text-xs text-muted-foreground", cell: (row: Expense) => new Date(row.expenseDate).toLocaleDateString() },
]

function ExpensesTableSkeleton() {
  return (
    <div className="w-full pt-2 space-y-3">
      <div className="rounded-md border border-zinc-200 bg-card overflow-hidden dark:border-zinc-800">
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 h-10" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 flex items-center h-12 px-4 gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExpensesTable() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useExpenses(page, 20)

  if (isLoading) return <ExpensesTableSkeleton />

  if (isError) {
    return (
      <div className="w-full pt-2">
        <UniversalDataTable data={[]} columns={columns} rowId={(e: Expense) => e.id} emptyMessage="Failed to load expenses. Check your connection and try again." />
      </div>
    );
  }

  return (
    <div className="w-full pt-2">
      <UniversalDataTable data={data?.data ?? []} columns={columns} rowId={(e: Expense) => e.id} emptyMessage="No operational expenditure accounts matched this filter set." pagination={data?.pagination} onPageChange={setPage} />
    </div>
  );
}
