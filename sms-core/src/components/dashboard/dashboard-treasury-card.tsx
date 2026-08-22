"use client"

import * as React from "react"
import {
  TrendingUp,
  Plus,
  Receipt,
  Landmark,
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

interface DashboardTreasuryCardProps {
  totalRevenue?: number
  trendPct?: number
  spentBudget?: number
  totalBudget?: number
  onCollectPayment?: () => void
  onIssueInvoice?: () => void
}

const feeStreams = [
  {
    name: "Tuition",
    percentage: 62,
    status: "Active",
    accent: "bg-sky-500",
  },
  {
    name: "Boarding",
    percentage: 26,
    status: "Active",
    accent: "bg-violet-500",
  },
  {
    name: "PTA Levies",
    percentage: 12,
    status: "Standby",
    accent: "bg-amber-500",
  },
]

export function DashboardTreasuryCard({
  totalRevenue = 689372,
  trendPct = 5.4,
  spentBudget = 180000,
  totalBudget = 350000,
  onCollectPayment,
  onIssueInvoice,
}: DashboardTreasuryCardProps) {
  const budgetPct =
    totalBudget > 0
      ? Math.round((spentBudget / totalBudget) * 100)
      : 0

  const budgetWidth = Math.min(budgetPct, 100)
  const isOverBudget = spentBudget > totalBudget

  return (
    <Card className="h-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-none">
      {/* Header */}
      <CardHeader className="px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardDescription className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            <Landmark className="size-3.5" />
            Total School Revenue
          </CardDescription>

          <Badge
            variant="outline"
            className="h-6 rounded-md px-2 text-[10px] font-medium"
          >
            🇬🇭 GHS
          </Badge>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <CardTitle className="text-[2.5rem] font-semibold leading-none tracking-[-0.045em] sm:text-[3rem]">
            GH₵{totalRevenue.toLocaleString()}
          </CardTitle>

          <div className="mb-1 flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-3.5" />
            <span>+{trendPct}%</span>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Revenue collected this term
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4">
          <Button
            type="button"
            onClick={onCollectPayment}
            className="h-9 rounded-md px-3.5 text-sm font-medium shadow-none"
          >
            <Plus className="size-4" />
            Record Payment
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onIssueInvoice}
            className="h-9 rounded-md border-border px-3.5 text-sm font-medium shadow-none"
          >
            <Receipt className="size-4" />
            Issue Invoice
          </Button>
        </div>
      </CardHeader>

      {/* Fee Distribution */}
      <CardContent className="px-5 pt-7 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium">Fee streams</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Revenue distribution
            </p>
          </div>
        </div>

        {/* Single distribution bar */}
        <div className="mt-4 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {feeStreams.map((stream) => (
            <div
              key={stream.name}
              className={`${stream.accent} first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${stream.percentage}%` }}
            />
          ))}
        </div>

        {/* Distribution data */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-border/70">
          {feeStreams.map((stream) => (
            <div
              key={stream.name}
              className="min-w-0 px-3 first:pl-0 last:pr-0"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${stream.accent}`}
                />

                <span className="truncate text-xs font-medium">
                  {stream.name}
                </span>
              </div>

              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tracking-tight">
                  {stream.percentage}%
                </span>

                <span
                  className={`text-[10px] ${
                    stream.status === "Active"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {stream.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Budget */}
      <CardContent className="mt-7 border-t border-border/60 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              Term Operating Budget
            </p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Budget consumption
            </p>
          </div>

          <span
            className={`text-xs font-semibold ${
              isOverBudget
                ? "text-red-600 dark:text-red-400"
                : "text-orange-600 dark:text-orange-400"
            }`}
          >
            {budgetPct}% utilized
          </span>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              isOverBudget ? "bg-red-500" : "bg-orange-500"
            }`}
            style={{
              width: `${budgetWidth}%`,
            }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            GH₵ {spentBudget.toLocaleString()} spent
          </span>

          <span>
            GH₵ {totalBudget.toLocaleString()} total budget
          </span>
        </div>
      </CardContent>
    </Card>
  )
}