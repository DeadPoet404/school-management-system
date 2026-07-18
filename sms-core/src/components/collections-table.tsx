"use client"

import * as React from "react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  UniversalDataTable,
  DataTableColumn,
} from "@/components/universal-data-table"
import { useCollections } from "@/lib/api/finance"
import { Skeleton } from "@/components/ui/skeleton"

export type Collection = {
  id: string
  invoiceId: string
  studentId: string
  amountPaid: number
  paymentMethod: string
  referenceNo: string
  dateProcessed: string
  status: "Cleared" | "Pending"
}

const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
const zincBadge = "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 text-zinc-300 dark:border-zinc-800"

const currencyFormatter = (amount: number) => {
  return "GH\u20a5" + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const columns: DataTableColumn<Collection>[] = [
  {
    key: "id",
    header: "Collection ID",
    className: "w-[130px]",
    cellClassName: "font-mono text-xs text-muted-foreground",
  },
  {
    key: "invoiceId",
    header: "Invoice Ref",
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
    key: "amountPaid",
    header: "Amount Cleared",
    className: "w-[140px] text-right",
    cellClassName: "font-mono text-right text-sm text-emerald-600 dark:text-emerald-400 font-medium",
    cell: (row: Collection) => currencyFormatter(row.amountPaid),
  },
  {
    key: "paymentMethod",
    header: "Verified Protocol",
    className: "min-w-[160px]",
    cell: (row: Collection) => (
      <Badge variant="outline" className={"font-medium shadow-none " + zincBadge}>
        {row.paymentMethod}
      </Badge>
    ),
  },
  {
    key: "referenceNo",
    header: "External Audit Key / Ref",
    className: "min-w-[150px]",
    cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400",
  },
  {
    key: "status",
    header: "Clearance State",
    className: "w-[120px]",
    cell: (row: Collection) => {
      const isCleared = row.status === "Cleared"
      return (
        <Badge
          variant="outline"
          className={"font-medium tracking-wide shadow-none " + (isCleared ? greenBadge : amberBadge)}
        >
          {row.status}
        </Badge>
      )
    },
  },
  {
    key: "dateProcessed",
    header: "Processing Date",
    className: "w-[130px]",
    cellClassName: "font-mono text-xs text-muted-foreground",
    cell: (row: Collection) => new Date(row.dateProcessed).toLocaleDateString(),
  },
]

function CollectionsTableSkeleton() {
  return (
    <div className="w-full pt-2 space-y-3">
      <div className="rounded-md border border-zinc-200 bg-card overflow-hidden dark:border-zinc-800">
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 h-10" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 flex items-center h-12 px-4 gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CollectionsTable() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useCollections(page, 20)

  if (isLoading) return <CollectionsTableSkeleton />

  if (isError) {
    return (
      <div className="w-full pt-2">
        <UniversalDataTable
          data={[]}
          columns={columns}
          rowId={(collection: Collection) => collection.id}
          emptyMessage="Failed to load collections data. Check your connection and try again."
        />
      </div>
    )
  }

  return (
    <div className="w-full pt-2">
      <UniversalDataTable
        data={data?.data ?? []}
        columns={columns}
        rowId={(collection: Collection) => collection.id}
        emptyMessage="No historical revenue inflows logged for this balancing context."
        pagination={data?.pagination}
        onPageChange={setPage}
      />
    </div>
  )
}