"use client"

import * as React from "react"
import {
  AlertCircle,
  BellRing,
  ChevronRight,
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
import type {
  ReceivablesAgingData,
  TopDebtorsData,
} from "@/lib/api/dashboard"

const fallbackAging = {
  current: {
    count: 6,
    amount: 18200,
  },
  days1to30: {
    count: 4,
    amount: 14800,
  },
  days31to60: {
    count: 3,
    amount: 11400,
  },
  over60: {
    count: 1,
    amount: 8228,
  },
}

const fallbackDebtors = [
  {
    studentId: "HHA-0001",
    studentName: "Ama Yaw Osei",
    className: "JHS 1A",
    balance: 3450,
  },
  {
    studentId: "HHA-0089",
    studentName: "Kwame Mensah",
    className: "SHS 2 Arts",
    balance: 2100,
  },
  {
    studentId: "HHA-0312",
    studentName: "Abena Serwaa",
    className: "Primary 6B",
    balance: 1850,
  },
  {
    studentId: "HHA-0448",
    studentName: "Kofi Asare",
    className: "JHS 3B",
    balance: 1780,
  },
  {
    studentId: "HHA-0512",
    studentName: "Nana Adjei",
    className: "SHS 1 Science",
    balance: 1650,
  },
  {
    studentId: "HHA-0671",
    studentName: "Akua Mensima",
    className: "JHS 2A",
    balance: 1520,
  },
  {
    studentId: "HHA-0714",
    studentName: "Yaw Boateng",
    className: "SHS 2 Science",
    balance: 1380,
  },
  {
    studentId: "HHA-0831",
    studentName: "Esi Owusu",
    className: "Primary 5A",
    balance: 1240,
  },
  {
    studentId: "HHA-0943",
    studentName: "Kojo Antwi",
    className: "JHS 1B",
    balance: 1190,
  },
  {
    studentId: "HHA-1032",
    studentName: "Adwoa Sarpong",
    className: "SHS 1 Arts",
    balance: 980,
  },
]

interface DashboardReceivablesCardProps {
  aging?: ReceivablesAgingData
  debtors?: TopDebtorsData
}

export function DashboardReceivablesCard({
  aging: agingData,
  debtors: debtorData,
}: DashboardReceivablesCardProps) {
  const aging = agingData?.buckets ?? fallbackAging
  const debtors = debtorData?.debtors ?? fallbackDebtors

  const openInvoicesCount =
    aging.current.count +
    aging.days1to30.count +
    aging.days31to60.count +
    aging.over60.count

  const agingTotal =
    aging.current.amount +
    aging.days1to30.amount +
    aging.days31to60.amount +
    aging.over60.amount

  const agingItems = [
    {
      label: "Current",
      amount: aging.current.amount,
      count: aging.current.count,
      color: "bg-slate-400",
    },
    {
      label: "1–30d",
      amount: aging.days1to30.amount,
      count: aging.days1to30.count,
      color: "bg-amber-400",
    },
    {
      label: "31–60d",
      amount: aging.days31to60.amount,
      count: aging.days31to60.count,
      color: "bg-orange-500",
    },
    {
      label: "60d+",
      amount: aging.over60.amount,
      count: aging.over60.count,
      color: "bg-rose-500",
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
            {openInvoicesCount} open
          </Badge>
        </div>

        <CardTitle className="mt-3 text-[2.45rem] font-semibold leading-none tracking-[-0.05em]">
          GH₵{(agingData?.totalOutstanding ?? 0).toLocaleString()}
        </CardTitle>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Outstanding across student ledgers
        </p>
      </CardHeader>

      {/* Aging */}
      <CardContent className="shrink-0 px-5 pt-6 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium">
              Receivables aging
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Balance by age
            </p>
          </div>

          <span className="text-[10px] text-muted-foreground">
            {openInvoicesCount} ledgers
          </span>
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
          {agingItems.map((item, index) => (
            <div
              key={item.label}
              className={`${item.color} ${
                index === 0 ? "rounded-l-full" : ""
              } ${
                index === agingItems.length - 1
                  ? "rounded-r-full"
                  : ""
              }`}
              style={{
                width: `${(item.amount / agingTotal) * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-4 divide-x divide-border/70">
          {agingItems.map((item) => (
            <div
              key={item.label}
              className="px-1.5 first:pl-0 last:pr-0"
            >
              <div className="flex items-center gap-1">
                <span
                  className={`size-1.5 rounded-full ${item.color}`}
                />

                <span className="text-[9px] text-muted-foreground">
                  {item.label}
                </span>
              </div>

              <p className="mt-1 text-sm font-semibold">
                GH₵{Math.round(item.amount / 1000)}k
              </p>

              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {item.count} ledgers
              </p>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Scrollable debtor area */}
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-0 pt-6 sm:px-6">
        <div className="flex shrink-0 items-end justify-between">
          <div>
            <p className="text-xs font-medium">
              Priority arrears
            </p>

            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Highest outstanding balances
            </p>
          </div>

          <span className="text-[10px] text-muted-foreground">
            Top {debtors.length}
          </span>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="divide-y divide-border/60 border-y border-border/60">
            {debtors.map((debtor) => (
              <div
                key={debtor.studentId}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">
                    {debtor.studentName}
                  </p>

                  <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                    {debtor.className} · {debtor.studentId}
                  </p>
                </div>

                <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                  GH₵{debtor.balance.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardContent className="flex shrink-0 items-center justify-between border-t border-border/60 px-5 py-4 sm:px-6">
        <Button
          type="button"
          size="sm"
          onClick={() => window.location.assign("/finance")}
          className="h-8 rounded-md px-3 text-[10px] font-medium shadow-none"
        >
          <BellRing className="mr-1.5 size-3.5" />
          Send Reminders
        </Button>

        <a
          href="/finance"
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          Debtors Ledger
          <ChevronRight className="size-3.5" />
        </a>
      </CardContent>
    </Card>
  )
}