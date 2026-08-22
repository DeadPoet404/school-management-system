"use client"

import * as React from "react"
import {
  Landmark,
  Plus,
  Receipt,
  TrendingUp,
  Smartphone,
  Building2,
  Banknote,
  CreditCard,
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

interface DashboardTreasuryCardProps {
  totalRevenue?: number
  totalInvoiced?: number
  trendPct?: number
  spentBudget?: number
  totalBudget?: number
  onCollectPayment?: () => void
  onIssueInvoice?: () => void
}

const paymentMethods = [
  {
    name: "Mobile Money",
    amount: 317112,
    percentage: 46,
    icon: Smartphone,
  },
  {
    name: "Bank Transfer",
    amount: 193024,
    percentage: 28,
    icon: Building2,
  },
  {
    name: "Cash",
    amount: 117193,
    percentage: 17,
    icon: Banknote,
  },
  {
    name: "Card / POS",
    amount: 48256,
    percentage: 7,
    icon: CreditCard,
  },
  {
    name: "Cheque",
    amount: 13787,
    percentage: 2,
    icon: WalletCards,
  },
]

const recentCollections = [
  {
    student: "Ama Yaw Osei",
    reference: "PAY-009381",
    amount: 3450,
    method: "Mobile Money",
  },
  {
    student: "Kwame Mensah",
    reference: "PAY-009374",
    amount: 2800,
    method: "Bank Transfer",
  },
  {
    student: "Abena Serwaa",
    reference: "PAY-009362",
    amount: 1850,
    method: "Cash",
  },
  {
    student: "Kofi Asare",
    reference: "PAY-009351",
    amount: 4200,
    method: "Mobile Money",
  },
  {
    student: "Nana Adjei",
    reference: "PAY-009344",
    amount: 1750,
    method: "Card / POS",
  },
]

export function DashboardTreasuryCard({
  totalRevenue = 0,
  totalInvoiced = 0,
  trendPct = 0,
  spentBudget = 180000,
  totalBudget = 350000,
  onCollectPayment,
  onIssueInvoice,
}: DashboardTreasuryCardProps) {
  const budgetPct =
    totalBudget > 0
      ? Math.round((spentBudget / totalBudget) * 100)
      : 0

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-none">
      <CardHeader className="shrink-0 px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardDescription className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em]">
            <Landmark className="size-3.5" />
            Total School Revenue
          </CardDescription>

          <Badge
            variant="outline"
            className="h-6 rounded-md px-2 text-[10px]"
          >
            🇬🇭 GHS
          </Badge>
        </div>

        <CardTitle className="mt-3 text-[2.45rem] font-semibold leading-none tracking-[-0.05em]">
          GH₵{totalRevenue.toLocaleString()}
        </CardTitle>

        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="size-3.5" />
          +{trendPct}% than last term
        </div>

        <p className="mt-1 text-[11px] text-muted-foreground">
          GH₵{totalInvoiced.toLocaleString()} invoiced this term
        </p>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            onClick={onCollectPayment}
            className="h-9 rounded-md px-3 text-[11px] font-medium shadow-none"
          >
            <Plus className="size-3.5" />
            Record Payment
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onIssueInvoice}
            className="h-9 rounded-md px-3 text-[11px] font-medium shadow-none"
          >
            <Receipt className="size-3.5" />
            Issue Invoice
          </Button>
        </div>
      </CardHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6">
        <div className="py-6">
          {/* Payment methods */}
          <div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium">
                  Collection mix
                </p>

                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Revenue by payment method
                </p>
              </div>

              <span className="text-[10px] text-muted-foreground">
                {paymentMethods.length} methods
              </span>
            </div>

            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
              {paymentMethods.map((method, index) => (
                <div
                  key={method.name}
                  className={`h-full bg-foreground/80 ${
                    index === 0 ? "rounded-l-full" : ""
                  } ${
                    index === paymentMethods.length - 1
                      ? "rounded-r-full"
                      : ""
                  }`}
                  style={{
                    width: `${method.percentage}%`,
                    opacity: 1 - index * 0.13,
                  }}
                />
              ))}
            </div>

            <div className="mt-3 space-y-1">
              {paymentMethods.map((method) => {
                const Icon = method.icon

                return (
                  <div
                    key={method.name}
                    className="flex items-center justify-between border-b border-border/50 py-2.5 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-muted-foreground" />

                      <span className="text-[11px]">
                        {method.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {method.percentage}%
                      </span>

                      <span className="text-[11px] font-semibold tabular-nums">
                        GH₵{method.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent collections */}
          <div className="mt-6 border-t border-border/60 pt-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Recent collections
            </p>

            <div className="mt-2 divide-y divide-border/50">
              {recentCollections.map((payment) => (
                <div
                  key={payment.reference}
                  className="flex items-center justify-between py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">
                      {payment.student}
                    </p>

                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {payment.reference} · {payment.method}
                    </p>
                  </div>

                  <span className="ml-3 shrink-0 text-[11px] font-semibold">
                    GH₵{payment.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget stays anchored */}
      <CardContent className="shrink-0 border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">
              Term Operating Budget
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              GH₵{spentBudget.toLocaleString()} spent
            </p>
          </div>

          <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">
            {budgetPct}% utilized
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-orange-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>

        <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
          <span>Spent</span>
          <span>
            GH₵{totalBudget.toLocaleString()} budget
          </span>
        </div>
      </CardContent>
    </Card>
  )
}