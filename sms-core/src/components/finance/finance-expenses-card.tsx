"use client"

import * as React from "react"
import { Receipt, TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useExpenses } from "@/lib/api/finance"

interface FinanceExpensesCardProps {
  totalExpenses: number
  totalExpensesCount: number
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

export function FinanceExpensesCard({
  totalExpenses,
  totalExpensesCount,
}: FinanceExpensesCardProps) {
  const expenses = useExpenses(1, 6)
  const rows = expenses.data?.data ?? []

  return (
    <Card className="flex h-full min-h-[430px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card py-0 shadow-sm">
      {/* Header */}
      <CardHeader className="px-6 pb-5 pt-6 sm:px-7 sm:pt-7">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardDescription className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Receipt className="size-4 text-[#FF5A36]" />
              Operating Expenses
            </CardDescription>

            <CardTitle className="text-xl font-semibold tracking-tight">
              Spending position
            </CardTitle>
          </div>

          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-4xl">
                {ghs(totalExpenses)}
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-end gap-1 text-sm">
              <TrendingUp className="size-3.5 text-[#FF5A36]" />
              <span className="text-[11px] font-medium text-muted-foreground">
                {totalExpensesCount.toLocaleString()} records
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Recent expenses */}
      <CardContent className="flex min-h-0 flex-1 flex-col px-6 sm:px-7">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Recent expenses</span>
          <span className="text-sm text-muted-foreground">Latest spend</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-border/60">
          {expenses.isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 animate-pulse rounded-md bg-muted/50"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-muted-foreground">
              No expenses recorded yet
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">
                      {expense.vendorName}
                    </p>

                    <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                      {expense.category} · {formatDate(expense.expenseDate)}
                    </p>
                  </div>

                  <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                    {ghs(expense.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Comparison footer */}
      <CardFooter className="mt-auto flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3.5 sm:px-7">
        <span className="text-[10px] text-muted-foreground">
          Payroll accounted separately
        </span>

        <a
          href="/finance?view=table"
          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          View all →
        </a>
      </CardFooter>
    </Card>
  )
}
