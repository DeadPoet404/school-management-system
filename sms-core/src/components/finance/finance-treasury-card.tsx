"use client"

import * as React from "react"
import {
  Landmark,
  Plus,
  Receipt,
  WalletCards,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCollections } from "@/lib/api/finance"

interface FinanceTreasuryCardProps {
  totalCollected: number
  totalInvoiced: number
  coveragePct: number
  totalCollectionsCount: number
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

export function FinanceTreasuryCard({
  totalCollected,
  totalInvoiced,
  coveragePct,
  totalCollectionsCount,
}: FinanceTreasuryCardProps) {
  const collections = useCollections(1, 6)
  const rows = collections.data?.data ?? []

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-none">
      <CardHeader className="shrink-0 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardDescription className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em]">
            <Landmark className="size-3.5" />
            Total Revenue Collected
          </CardDescription>

          <Badge
            variant="outline"
            className="h-6 rounded-md px-2 text-[10px]"
          >
            🇬🇭 GHS
          </Badge>
        </div>

        <CardTitle className="mt-3 text-[2.45rem] font-semibold leading-none tracking-[-0.05em] tabular-nums">
          {ghs(totalCollected)}
        </CardTitle>

        <p className="mt-1 text-[11px] text-muted-foreground">
          {ghs(totalInvoiced)} invoiced all-time
        </p>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            asChild
            className="h-9 rounded-md px-3 text-[11px] font-medium shadow-none"
          >
            <a href="/finance?view=table">
              <Plus className="size-3.5" />
              Record Payment
            </a>
          </Button>

          <Button
            type="button"
            variant="outline"
            asChild
            className="h-9 rounded-md px-3 text-[11px] font-medium shadow-none"
          >
            <a href="/finance?view=table">
              <Receipt className="size-3.5" />
              Issue Invoice
            </a>
          </Button>
        </div>
      </CardHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6">
        <div className="py-6">
          {/* Recent collections */}
          <div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium">
                  Recent collections
                </p>

                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Latest payments received
                </p>
              </div>

              <span className="text-[10px] text-muted-foreground">
                {totalCollectionsCount.toLocaleString()} all-time
              </span>
            </div>

            {collections.isLoading ? (
              <div className="mt-3 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-9 animate-pulse rounded-md bg-muted/50"
                  />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-[11px] text-muted-foreground">
                No collections recorded yet
              </div>
            ) : (
              <div className="mt-2 divide-y divide-border/50">
                {rows.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium">
                        {payment.paymentMethod}
                      </p>

                      <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                        {payment.referenceNo} ·{" "}
                        {formatDate(payment.dateProcessed)}
                      </p>
                    </div>

                    <span className="ml-3 shrink-0 text-[11px] font-semibold tabular-nums">
                      {ghs(payment.amountPaid)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lifetime position */}
          <div className="mt-6 border-t border-border/60 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <WalletCards className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-medium">
                  Collection coverage
                </p>
              </div>

              <span className="text-[10px] font-semibold text-[#00A896]">
                {coveragePct}% collected
              </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#00A896]"
                style={{ width: `${Math.min(coveragePct, 100)}%` }}
              />
            </div>

            <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
              <span>{ghs(totalCollected)} collected</span>
              <span>{ghs(totalInvoiced)} invoiced</span>
            </div>
          </div>
        </div>
      </div>

      {/* Anchored footer */}
      <CardContent className="shrink-0 border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
        <a
          href="/finance?view=table"
          className="flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <span>Manage payments & invoices</span>
          <span aria-hidden>→</span>
        </a>
      </CardContent>
    </Card>
  )
}
