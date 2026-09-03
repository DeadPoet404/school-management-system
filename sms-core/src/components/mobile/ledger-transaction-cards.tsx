"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"
import { MobilePager } from "@/components/mobile/mobile-pager"
import type { Invoice } from "@/components/invoices-table"
import type { Collection } from "@/components/collections-table"
import type { Expense } from "@/components/expenses-table"
import type { PayrollRecord } from "@/components/payroll-table"

const GH = (n: number) =>
  `GH₵ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString() : "—"

type PagerMeta = { page?: number; totalPages?: number } | undefined

const pillClass = (status: string) => {
  const s = status.toLowerCase()
  if (s === "paid" || s === "cleared")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
  if (s === "partial" || s === "pending" || s === "processing" || s === "pending_approval" || s === "on_hold")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400"
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400"
}

const StatusPill = ({ status }: { status: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold",
      pillClass(status)
    )}
  >
    {status.replace(/_/g, " ")}
  </span>
)

interface CardsShellProps {
  children: React.ReactNode
  pagination?: PagerMeta
  onPageChange?: (page: number) => void
  emptyMessage: string
}

function CardsShell({
  children,
  pagination,
  onPageChange,
  emptyMessage,
}: CardsShellProps) {
  return (
    <>
      {React.Children.count(children) === 0 ? (
        <div className="flex h-48 items-center justify-center px-6 text-center text-xs text-zinc-400">
          {emptyMessage}
        </div>
      ) : (
        children
      )}

      {pagination && onPageChange ? (
        <MobilePager
          page={pagination.page ?? 1}
          totalPages={pagination.totalPages ?? 1}
          onPageChange={onPageChange}
        />
      ) : null}
    </>
  )
}

// ── Invoices ────────────────────────────────────────────────────────────
export function InvoiceCards({
  rows,
  pagination,
  onPageChange,
}: {
  rows: Invoice[]
  pagination?: PagerMeta
  onPageChange?: (page: number) => void
}) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => {
        const balance = row.totalAmount - row.paidAmount
        return {
          id: row.id,
          primary: row.feeCategory,
          meta: (
            <>
              {row.id} · {row.studentId}
            </>
          ),
          chips: [
            <StatusPill key="s" status={row.status} />,
            row.status !== "Paid" ? (
              <span key="b" className="text-[10px] font-medium text-zinc-400">
                {fmtDate(row.dueDate)} due
              </span>
            ) : null,
          ],
          trailing: (
            <span
              className={cn(
                "font-mono text-[15px] font-black tracking-tight",
                balance > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {balance > 0 ? GH(balance) : "Settled"}
            </span>
          ),
          sheetTitle: row.feeCategory,
          sheetDescription: `${row.id} · ${row.studentId}`,
          sheetRows: [
            { label: "Invoice ID", value: row.id },
            { label: "Student ID", value: row.studentId },
            { label: "Fee Category", value: row.feeCategory },
            { label: "Total", value: GH(row.totalAmount) },
            { label: "Paid", value: GH(row.paidAmount) },
            {
              label: "Balance",
              value: balance > 0 ? GH(balance) : "Settled",
            },
            {
              label: "Status",
              value: <StatusPill status={row.status} />,
            },
            { label: "Issue Date", value: fmtDate(row.issueDate) },
            { label: "Due Date", value: fmtDate(row.dueDate) },
          ],
        }
      }),
    [rows]
  )

  return (
    <CardsShell
      pagination={pagination}
      onPageChange={onPageChange}
      emptyMessage="No invoices found."
    >
      <MobileCardList rows={items} />
    </CardsShell>
  )
}

// ── Collections ─────────────────────────────────────────────────────────
export function CollectionCards({
  rows,
  pagination,
  onPageChange,
}: {
  rows: Collection[]
  pagination?: PagerMeta
  onPageChange?: (page: number) => void
}) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.studentId,
        meta: (
          <>
            {row.id}
            {row.referenceNo ? ` · ${row.referenceNo}` : ""}
          </>
        ),
        chips: [
          <StatusPill key="s" status={row.status} />,
          row.paymentMethod ? (
            <span
              key="pm"
              className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400"
            >
              {row.paymentMethod}
            </span>
          ) : null,
        ],
        trailing: (
          <span className="font-mono text-[15px] font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {GH(row.amountPaid)}
          </span>
        ),
        sheetTitle: row.studentId,
        sheetDescription: `${row.id} · Collection record`,
        sheetRows: [
          { label: "Collection ID", value: row.id },
          { label: "Invoice Ref", value: row.invoiceId },
          { label: "Student ID", value: row.studentId },
          { label: "Amount Cleared", value: GH(row.amountPaid) },
          { label: "Verified Protocol", value: row.paymentMethod },
          { label: "External Audit Key / Ref", value: row.referenceNo },
          {
            label: "Clearance State",
            value: <StatusPill status={row.status} />,
          },
          { label: "Processing Date", value: fmtDate(row.dateProcessed) },
        ],
      })),
    [rows]
  )

  return (
    <CardsShell
      pagination={pagination}
      onPageChange={onPageChange}
      emptyMessage="No collections found."
    >
      <MobileCardList rows={items} />
    </CardsShell>
  )
}

// ── Payroll ─────────────────────────────────────────────────────────────
export function PayrollCards({
  rows,
  pagination,
  onPageChange,
}: {
  rows: PayrollRecord[]
  pagination?: PagerMeta
  onPageChange?: (page: number) => void
}) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.staffName,
        meta: (
          <>
            {row.payPeriod}
            {row.id ? ` · ${row.id}` : ""}
          </>
        ),
        chips: [<StatusPill key="s" status={row.status} />],
        trailing: (
          <span className="font-mono text-[15px] font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {GH(row.netPay)}
          </span>
        ),
        sheetTitle: row.staffName,
        sheetDescription: `${row.payPeriod}${row.id ? ` · ${row.id}` : ""}`,
        sheetRows: [
          { label: "Payroll ID", value: row.id },
          { label: "Staff Member", value: row.staffName },
          { label: "Base Salary", value: GH(row.baseSalary) },
          { label: "Allowances", value: GH(row.allowances) },
          { label: "Deductions", value: GH(row.deductions) },
          { label: "Net Distribution", value: GH(row.netPay) },
          { label: "Pay Period", value: row.payPeriod },
          {
            label: "Disbursement Status",
            value: <StatusPill status={row.status} />,
          },
        ],
      })),
    [rows]
  )

  return (
    <CardsShell
      pagination={pagination}
      onPageChange={onPageChange}
      emptyMessage="No payroll records found."
    >
      <MobileCardList rows={items} />
    </CardsShell>
  )
}

// ── Expenses ────────────────────────────────────────────────────────────
export function ExpenseCards({
  rows,
  pagination,
  onPageChange,
}: {
  rows: Expense[]
  pagination?: PagerMeta
  onPageChange?: (page: number) => void
}) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        primary: row.vendorName,
        meta: (
          <>
            {row.id} · {fmtDate(row.expenseDate)}
          </>
        ),
        chips: [
          <StatusPill key="s" status={row.status} />,
          row.category ? (
            <span
              key="c"
              className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400"
            >
              {row.category}
            </span>
          ) : null,
        ],
        trailing: (
          <span className="font-mono text-[15px] font-black tracking-tight text-rose-600 dark:text-rose-400">
            {GH(row.amount)}
          </span>
        ),
        sheetTitle: row.vendorName,
        sheetDescription: `${row.id} · Expense record`,
        sheetRows: [
          { label: "Expense ID", value: row.id },
          { label: "Payee / Vendor", value: row.vendorName },
          { label: "Category", value: row.category },
          { label: "Description", value: row.description },
          { label: "Total Outflow", value: GH(row.amount) },
          { label: "Payment Channel", value: row.paymentMethod },
          {
            label: "Approval State",
            value: <StatusPill status={row.status} />,
          },
          { label: "Posting Date", value: fmtDate(row.expenseDate) },
        ],
      })),
    [rows]
  )

  return (
    <CardsShell
      pagination={pagination}
      onPageChange={onPageChange}
      emptyMessage="No expenses found."
    >
      <MobileCardList rows={items} />
    </CardsShell>
  )
}
