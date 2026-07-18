"use client"

import * as React from "react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  UniversalDataTable,
  DataTableColumn,
} from "@/components/universal-data-table"
import { usePayroll, type PayrollRecord } from "@/lib/api/finance"
import { Skeleton } from "@/components/ui/skeleton"

export type { PayrollRecord }

const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
const blueBadge = "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60"
const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"

const currencyFormatter = (amount: number) => {
  return "GH\u20a5" + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
    className: "w-[120py]",
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
        <Badge variant="outline" className={"font-medium tracking-wide shadow-none " + statusStyle}>
          {displayLabel}
        </Badge>
      )
    },
  },
]

function PayrollTableSkeleton() {
  return (
    <div className="w-full pt-2 space-y-3">
      <div className="rounded-md border border-zinc-200 bg-card overflow-hidden dark:border-zinc-800">
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 h-10" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 flex items center h-12 px-4 gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PayrollTable() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = usePayroll(page, 20)

  if (isLoading) return <PayrollTableSkeleton />

  if (isError) {
    return (
      <div className="w-full pt-2">
        <UniversalDataTable
          data={[]}
          columns={columns}
          rowId={(record) => record.id}
          emptyMessage="Failed to load payroll data. Check your connection and try again."
        />
      </div>
    )
  }

  return (
    <div className="w-full pt-2">
      <UniversalDataTable
        data={data?.data ?? []}
        columns={columns}
        rowId={(record) => record.id}
        emptyMessage="No organizational payroll allocations found for this ledger period."
        pagination={data?.pagination}
        onPageChange={setPage}
      />
    </div>
  )
}
