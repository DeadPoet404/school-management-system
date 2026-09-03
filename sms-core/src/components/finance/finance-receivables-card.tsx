"use client"

import * as React from "react"
import { AlertCircle, ChevronRight } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useInvoices } from "@/lib/api/finance"
import type { InvoiceRecord } from "@/lib/api/finance"

interface FinanceReceivablesCardProps {
  outstanding: number
  invoicePayments: number
  invoiced: number
  openInvoices: number
  paidInvoices: number
  partialInvoices: number
  totalInvoices: number
}

function ghs(value: number) {
  return `GH₵${Math.round(value || 0).toLocaleString()}`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })
}

function openBalance(invoice: InvoiceRecord) {
  return Math.max(
    Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0),
    0,
  )
}

function statusLabel(invoice: InvoiceRecord) {
  if (invoice.status === "Partial") return "Partial"
  const due = new Date(invoice.dueDate)
  if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
    return "Overdue"
  }
  return "Open"
}

export function FinanceReceivablesCard({
  outstanding,
  invoicePayments,
  invoiced,
  openInvoices,
  paidInvoices,
  partialInvoices,
  totalInvoices,
}: FinanceReceivablesCardProps) {
  const invoices = useInvoices(1, 12)

  const priorityArrears = React.useMemo(() => {
    const rows = (invoices.data?.data ?? [])
      .filter((invoice) => {
        const balance = openBalance(invoice)
        return balance > 0 && invoice.status !== "Paid"
      })
      .sort((a, b) => openBalance(b) - openBalance(a))
    return rows.slice(0, 5)
  }, [invoices.data])

  const denominator = Math.max(totalInvoices, 1)
  const collectedPct =
    invoiced > 0
      ? Math.min(Math.round((invoicePayments / invoiced) * 100), 100)
      : 0

  const split = [
    {
      label: "Paid",
      count: paidInvoices,
      color: "#00A896",
    },
    {
      label: "Partial",
      count: partialInvoices,
      color: "#F4C430",
    },
    {
      label: "Open",
      count: openInvoices,
      color: "#FF5A36",
    },
  ]

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-none">
      <CardHeader className="shrink-0 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardDescription className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em]">
            <AlertCircle className="size-3.5 text-orange-500" />
            Fee Receivables
          </CardDescription>

          <Badge
            variant="outline"
            className="h-6 rounded-md px-2 text-[10px]"
          >
            {openInvoices.toLocaleString()} open
          </Badge>
        </div>

        <CardTitle className="mt-3 text-[2.45rem] font-semibold leading-none tracking-[-0.05em] tabular-nums">
          {ghs(outstanding)}
        </CardTitle>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Outstanding across student invoices
        </p>
      </CardHeader>

      {/* Split */}
      <CardContent className="shrink-0 px-5 pt-6 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium">Invoice position</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Share of {totalInvoices.toLocaleString()} invoices
            </p>
          </div>

          <span className="text-[10px] font-semibold text-[#00A896]">
            {collectedPct}% collected
          </span>
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
          {split.map((item, index) => {
            const share = (item.count / denominator) * 100
            if (share <= 0) return null
            return (
              <div
                key={item.label}
                className={index === 0 ? "rounded-l-full" : ""}
                style={{
                  width: `${share}%`,
                  backgroundColor: item.color,
                }}
              />
            )
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-border/70">
          {split.map((item) => (
            <div
              key={item.label}
              className="px-2 first:pl-0 last:pr-0"
            >
              <div className="flex items-center gap-1">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[9px] text-muted-foreground">
                  {item.label}
                </span>
              </div>

              <p className="mt-1 text-sm font-semibold tabular-nums">
                {item.count.toLocaleString()}
              </p>

              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {((item.count / denominator) * 100).toFixed(0)}% of invoices
              </p>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Scrollable priority arrears */}
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-0 pt-6 sm:px-6">
        <div className="flex shrink-0 items-end justify-between">
          <div>
            <p className="text-xs font-medium">Priority arrears</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Highest open invoice balances
            </p>
          </div>

          <span className="text-[10px] text-muted-foreground">
            Top {Math.max(priorityArrears.length, 1)}
          </span>
        </div>

        {invoices.isLoading ? (
          <div className="mt-3 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-md bg-muted/50"
              />
            ))}
          </div>
        ) : priorityArrears.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-[11px] text-muted-foreground">
            No open invoices — receivables are fully cleared
          </div>
        ) : (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="divide-y divide-border/60 border-y border-border/60">
              {priorityArrears.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">
                      {invoice.feeCategory}
                    </p>

                    <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                      {statusLabel(invoice)} · due{" "}
                      {formatDate(invoice.dueDate) || "—"}
                    </p>
                  </div>

                  <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                    {ghs(openBalance(invoice))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardContent className="flex shrink-0 items-center justify-between border-t border-border/60 px-5 py-4 sm:px-6">
        <Button
          type="button"
          size="sm"
          asChild
          className="h-8 rounded-md px-3 text-[10px] font-medium shadow-none"
        >
          <a href="/finance?view=table">Open Ledger</a>
        </Button>

        <a
          href="/finance?view=table"
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          Ledger Console
          <ChevronRight className="size-3.5" />
        </a>
      </CardContent>
    </Card>
  )
}
