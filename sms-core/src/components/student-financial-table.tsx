"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"
import { StudentFinancialCards } from "@/components/mobile/student-financial-cards"

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
  pagination?: { page: number; totalPages: number; totalItems: number; limit: number }
  onPageChange?: (page: number) => void
}

export function StudentFinancialTable({ data: rawStudents, pagination, onPageChange }: StudentFinancialTableProps) {
  const transformedData = React.useMemo(() => {
    const statusColorMap: Record<string, string> = {
      Active: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      Suspended: "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
      "Pending Review": "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-xs w-fit font-medium",
    }

    // Show the students with the most recent valid payment first. Students
    // without a payment are kept at the bottom, with a stable name tie-breaker.
    const latestPaymentTime = (item: any) => {
      const payments = Array.isArray(item.payments) ? item.payments : []
      return payments.reduce((latest: number, payment: any) => {
        if (payment.deletedAt) return latest
        const timestamp = new Date(payment.createdAt).getTime()
        return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest
      }, Number.NEGATIVE_INFINITY)
    }

    const orderedStudents = [...rawStudents].sort((a, b) => {
      const paymentOrder = latestPaymentTime(b) - latestPaymentTime(a)
      if (paymentOrder !== 0) return paymentOrder

      const nameA = String(a.studentName || a.account?.fullName || a.name || "")
      const nameB = String(b.studentName || b.account?.fullName || b.name || "")
      return nameA.localeCompare(nameB)
    })

    return orderedStudents.map((item, index) => {
      const currentStatus = item.status || "Active"
      const rawName = item.studentName || item.account?.fullName || item.name || "Unknown Student"
      const fallbackId = item.studentId || item.id || `STD-${index}`

      // Light path: backend already computed totals via groupBy (fast)
      // Heavy path: fallback to full invoice/payment arrays if present
      let rollingOutstandingBalance = 0
      let rawTransId = "—"
      let rawPaymentType = "—"
      let formattedDate = "—"
      let formattedAmountPaid = "—"

      if (item.invoices || item.payments) {
        // ── CLIENT-SIDE CHRONOLOGICAL LEDGER REDUCER (heavy) ──
        const rawInvoices = item.invoices || []
        const rawPayments = item.payments || []

        const invoiceLogs = rawInvoices.map((inv: any) => ({
          id: inv.invoiceNo,
          date: inv.createdAt,
          type: "Invoice",
          amount: Number(inv.amount) || 0,
        }))

        const paymentLogs = rawPayments.map((pay: any) => ({
          id: pay.receiptNo,
          date: pay.createdAt,
          type: pay.paymentType || "Payment",
          amount: Number(pay.amount) || 0,
        }))

        const sortedHistory = [...invoiceLogs, ...paymentLogs].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        sortedHistory.forEach((transaction) => {
          if (transaction.type === "Invoice") {
            rollingOutstandingBalance += transaction.amount
          } else {
            rollingOutstandingBalance -= transaction.amount
          }
        })

        const lastTx = sortedHistory[sortedHistory.length - 1]
        rawTransId = lastTx?.id || "—"
        rawPaymentType = lastTx?.type || "—"
        formattedDate = lastTx?.date
          ? new Date(lastTx.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : "—"
        const rawAmountPaid = lastTx && lastTx.type !== "Invoice" ? lastTx.amount : 0
        formattedAmountPaid = rawAmountPaid > 0 ? `₵ ${rawAmountPaid.toFixed(2)}` : "—"
      } else {
        // Light path
        const totalInvoiced = Number(item.totalInvoiced || 0)
        const totalPaid = Number(item.totalPaid || 0)
        rollingOutstandingBalance = Number(item.balanceRemaining ?? Math.max(0, totalInvoiced - totalPaid))
        const receiptCount = Number(item.paymentCount || 0)
        rawTransId = item.lastReceiptNo
          ? receiptCount > 1
            ? `${item.lastReceiptNo} · ${receiptCount} receipts`
            : item.lastReceiptNo
          : totalPaid > 0
            ? `Paid ₵${totalPaid.toFixed(2)}`
            : totalInvoiced > 0
              ? `Inv ₵${totalInvoiced.toFixed(2)}`
              : "—"
        rawPaymentType = item.lastPaymentType || item.feesStatus || "—"
        const lastAmount = Number(item.lastPaymentAmount || 0)
        formattedAmountPaid = lastAmount > 0 ? `₵ ${lastAmount.toFixed(2)}` : totalPaid > 0 ? `₵ ${totalPaid.toFixed(2)}` : "—"
        // Never use the admission date here. That made every unpaid-looking
        // row show the enrollment date as if it were a receipt.
        formattedDate = item.lastPaymentDate
          ? new Date(item.lastPaymentDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : "—"
      }

      const availableCredit = Number(item.billing?.creditBalance) || 0
      const owed = Math.max(
        0,
        rollingOutstandingBalance,
        Math.max(0, Number(item.totalInvoiced || 0) - Number(item.totalPaid || 0)),
        Number(item.billing?.currentBalance || 0),
      )
      const hasPaid = Number(item.totalPaid || 0) > 0 || (item.payments?.length ?? 0) > 0
      // A student who has never paid still owes the balance. Do not print a
      // dash in that case — the fees list is what the school prints.
      const balanceLabel = availableCredit > 0
        ? `Credit ₵ ${availableCredit.toFixed(2)}`
        : owed > 0
          ? `₵ ${owed.toFixed(2)}`
          : hasPaid
            ? "Settled"
            : "₵ 0.00"
      // Amount Paid is a dash when there is no receipt. That is the cell the
      // school sees when printing someone who still owes, so show the debt.
      if (owed > 0) {
        const owedLabel = `₵ ${owed.toFixed(2)}`
        // A student who has not paid used to print a dash in every empty
        // cell. The school prints this row, so the amount has to be in it.
        if (!hasPaid || formattedAmountPaid === "—") formattedAmountPaid = owedLabel
        if (formattedDate === "—") formattedDate = owedLabel
        if (rawTransId === "—") rawTransId = owedLabel
        if (rawPaymentType === "—" || !hasPaid) rawPaymentType = owedLabel
      } else if (formattedAmountPaid === "—") {
        formattedAmountPaid = "₵ 0.00"
      }
      if (formattedDate === "—") formattedDate = hasPaid ? "—" : "₵ 0.00"
      if (rawTransId === "—") rawTransId = "₵ 0.00"

      return {
        id: fallbackId,
        studentMeta: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight block truncate">
            {rawName}
            {owed > 0 && !hasPaid ? (
              <span className="ml-2 font-mono text-xs font-semibold text-red-600 dark:text-red-400">
                {`₵ ${owed.toFixed(2)}`}
              </span>
            ) : null}
          </span>
        ),
        lastTransactionId: rawTransId,
        lastTransactionDate: formattedDate,
        paymentType: rawPaymentType,
        amountPaid: formattedAmountPaid,
        balanceRemaining: (
          <span className={`font-mono font-semibold text-xs ${
            availableCredit > 0
              ? "text-sky-700 dark:text-sky-400"
              : owed > 0
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
          }`}>
            {balanceLabel}
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
    key: "balanceRemaining",
    header: "Fees Owed",
    className: "w-[120px]",
    cellClassName: "font-mono text-xs text-right whitespace-nowrap",
  },
  {
    key: "lastTransactionId",
    header: "Last Trans ID",
    className: "w-[220px] print:hidden",
    cellClassName:
      "font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate overflow-hidden select-all print:hidden",
  },
  {
    key: "lastTransactionDate",
    header: "Transaction Date",
    className: "w-[120px] print:hidden",
    cellClassName:
      "font-mono text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap print:hidden",
  },
  {
    key: "paymentType",
    header: "Type",
    className: "w-[90px] print:hidden",
    cellClassName: "print:hidden",
    cell: (row) => {
      if (row.paymentType === "—") {
        return <span className="font-mono text-xs font-semibold text-red-600 dark:text-red-400">₵ 0.00</span>
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
    className: "w-[120px]",
    cellClassName:
      "font-mono text-xs text-right whitespace-nowrap",
  },
  {
    key: "status",
    header: "Status",
    className: "w-[90px] print:hidden",
    cellClassName: "print:hidden",
  },
], [])

  return (
    <>
      <div className="hidden lg:block">
        <UniversalDataTable
          data={transformedData}
          columns={columns}
          rowId={(record) => record.id}
          emptyMessage="No core financial metrics mapped to active student bodies."
          pagination={pagination}
          onPageChange={onPageChange}
        />
      </div>

      <div className="lg:hidden">
        <StudentFinancialCards rows={transformedData} />
      </div>
    </>
  )
}