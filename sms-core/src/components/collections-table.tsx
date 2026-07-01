"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  UniversalDataTable,
  DataTableColumn,
} from "@/components/universal-data-table"

export type Collection = {
  id: string
  invoiceId: string
  studentId: string
  amountPaid: number
  paymentMethod: "Cash Settlement" | "Bank Wire Transfer" | "Mobile Money (MoMo)" | "Bank Cheque / Draft"
  referenceNo: string
  dateProcessed: string
  status: "Cleared" | "Pending"
}

const mockCollections: Collection[] = [
  {
    id: "COL-2026-042",
    invoiceId: "INV-2026-001",
    studentId: "UCC-CS-2024-042",
    amountPaid: 4500.00,
    paymentMethod: "Cash Settlement",
    referenceNo: "N/A (Direct)",
    dateProcessed: "2026-06-10",
    status: "Cleared",
  },
  {
    id: "COL-2026-043",
    invoiceId: "INV-2026-002",
    studentId: "UCC-CS-2025-115",
    amountPaid: 400.00,
    paymentMethod: "Bank Wire Transfer",
    referenceNo: "TXN-BNK88291",
    dateProcessed: "2026-06-12",
    status: "Cleared",
  },
  {
    id: "COL-2026-044",
    invoiceId: "INV-2026-005",
    studentId: "UCC-OPS-2024-302",
    amountPaid: 350.00,
    paymentMethod: "Mobile Money (MoMo)",
    referenceNo: "MOMO-REF-9901X",
    dateProcessed: "2026-06-18",
    status: "Pending",
  },
  {
    id: "COL-2026-045",
    invoiceId: "INV-2026-004",
    studentId: "UCC-SCI-2025-021",
    amountPaid: 650.00,
    paymentMethod: "Bank Cheque / Draft",
    referenceNo: "CHQ-009182",
    dateProcessed: "2026-06-19",
    status: "Cleared",
  }
]

export function CollectionsTable() {
  const greenBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
  const amberBadge = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60"
  const zincBadge = "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"

  const currencyFormatter = (amount: number) => {
    return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        <Badge variant="outline" className={`font-medium shadow-none ${zincBadge}`}>
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
            className={`font-medium tracking-wide shadow-none ${isCleared ? greenBadge : amberBadge}`}
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

  return (
    <div className="w-full pt-2">
      <UniversalDataTable
        data={mockCollections}
        columns={columns}
        rowId={(collection: Collection) => collection.id}
        emptyMessage="No historical revenue inflows logged for this balancing context."
      />
    </div>
  )
}