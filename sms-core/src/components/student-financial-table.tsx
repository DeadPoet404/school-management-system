"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

export type StudentFinancialRow = {
  id: string
  studentMeta: React.ReactNode
  lastTransactionId: string
  lastTransactionDate: string
  paymentType: string
  amountPaid: string
  balanceRemaining: React.ReactNode
  status: React.ReactNode
}

interface StudentFinancialTableProps {
  data: any[] // Guaranteed array from parent orchestrator
}

export function StudentFinancialTable({ data: rawStudents }: StudentFinancialTableProps) {
  const transformedData = React.useMemo(() => {
    const statusColorMap: Record<string, string> = {
      Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      Suspended: "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      "Pending Review": "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
    }

    return rawStudents.map((item, index) => {
      const currentStatus = item.status || "Active"
      const rawName = item.studentName || item.account?.fullName || item.name || "Unknown Student"
      const fallbackId = item.studentId || item.id || `STD-${index}`

      // ── CLIENT-SIDE CHRONOLOGICAL LEDGER REDUCER ──
      const rawInvoices = item.invoices || []
      const rawPayments = item.payments || []

      const invoiceLogs = rawInvoices.map((inv: any) => ({
        id: inv.invoiceNo,
        date: inv.createdAt,
        type: "Invoice",
        amount: inv.amount,
      }))

      const paymentLogs = rawPayments.map((pay: any) => ({
        id: pay.receiptNo,
        date: pay.createdAt,
        type: pay.paymentType || "Payment",
        amount: pay.amount,
      }))

      // Sort timeline from oldest to newest to compute the exact rolling balance balances
      const sortedHistory = [...invoiceLogs, ...paymentLogs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      let rollingOutstandingBalance = 0
      sortedHistory.forEach((transaction) => {
        if (transaction.type === "Invoice") {
          rollingOutstandingBalance += transaction.amount
        } else {
          rollingOutstandingBalance -= transaction.amount
        }
      })

      const lastTx = sortedHistory[sortedHistory.length - 1]
      const rawTransId = lastTx?.id || "—"
      const rawPaymentType = lastTx?.type || "—"
      
      const formattedDate = lastTx?.date
        ? new Date(lastTx.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "—"

      const rawAmountPaid = lastTx && lastTx.type !== "Invoice" ? lastTx.amount : 0
      const formattedAmountPaid = rawAmountPaid > 0 ? `GH₵ ${rawAmountPaid.toFixed(2)}` : "—"

      return {
        id: fallbackId,
        studentMeta: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight block truncate">
            {rawName}
          </span>
        ),
        lastTransactionId: rawTransId,
        lastTransactionDate: formattedDate,
        paymentType: rawPaymentType,
        amountPaid: formattedAmountPaid,
        balanceRemaining: (
          <span className={`font-mono font-semibold text-xs ${
            rollingOutstandingBalance > 0 
              ? "text-red-600 dark:text-red-400" 
              : "text-emerald-600 dark:text-emerald-400"
          }`}>
            {rollingOutstandingBalance <= 0 ? "Settled" : `GH₵ ${rollingOutstandingBalance.toFixed(2)}`}
          </span>
        ),
        status: (
          <div className={statusColorMap[currentStatus] || "text-zinc-500 text-xs font-medium"}>
            {currentStatus}
          </div>
        ),
      }
    })
  }, [rawStudents])

  const columns = React.useMemo<DataTableColumn<StudentFinancialRow>[]>(() => [
  {
    key: "id",
    header: "Student ID",
    className: "w-[90px]",
    cellClassName: "font-mono text-xs text-muted-foreground tracking-wider",
  },
  {
    key: "studentMeta",
    header: "Student Name",
    className: "w-[180px]",
    cellClassName: "truncate",
  },
  {
    key: "lastTransactionId",
    header: "Last Trans ID",
    className: "w-[220px]",
    cellClassName:
      "font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate overflow-hidden select-all",
  },
  {
    key: "lastTransactionDate",
    header: "Transaction Date",
    className: "w-[120px]",
    cellClassName:
      "font-mono text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap",
  },
  {
    key: "paymentType",
    header: "Type",
    className: "w-[90px]",
    cell: (row) => {
      if (row.paymentType === "—") {
        return <span className="text-zinc-400">—</span>
      }

      const isInvoice = row.paymentType === "Invoice"

      return (
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${
            isInvoice
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
          }`}
        >
          {row.paymentType}
        </span>
      )
    },
  },
  {
    key: "amountPaid",
    header: "Amount Paid",
    className: "w-[85px]",
    cellClassName:
      "font-mono text-xs text-right whitespace-nowrap",
  },
  {
    key: "balanceRemaining",
    header: "Balance Owed",
    className: "w-[85px]",
    cellClassName:
      "font-mono text-xs text-right whitespace-nowrap",
  },
  {
    key: "status",
    header: "Status",
    className: "w-[90px]",
  },
], [])

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No core financial metrics mapped to active student bodies."
    />
  )
}