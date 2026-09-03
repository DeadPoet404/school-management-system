"use client"

import * as React from "react"
import {
  Banknote,
  CheckCircle2,
  Clock3,
  UsersRound,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface FinancePayrollCardProps {
  payrollAmount: number
  payrollRecords: number
  pendingPayroll: number
}

export function FinancePayrollCard({
  payrollAmount,
  payrollRecords,
  pendingPayroll,
}: FinancePayrollCardProps) {
  const processedRecords = Math.max(payrollRecords - pendingPayroll, 0)

  const processedPct =
    payrollRecords > 0
      ? Math.min((processedRecords / payrollRecords) * 100, 100)
      : 0

  const pendingPct =
    payrollRecords > 0
      ? Math.max((pendingPayroll / payrollRecords) * 100, 0)
      : 0

  return (
    <Card className="flex h-full min-h-[430px] flex-col overflow-hidden rounded-[24px] border border-border/60 bg-card py-0 shadow-sm">
      {/* HEADER */}
      <CardHeader className="px-6 pb-0 pt-6 sm:px-7 sm:pt-7">
        <div className="flex items-start justify-between">
          <div>
            <CardDescription className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
              <Banknote className="size-3.5 text-[#FF5A36]" />
              Payroll
            </CardDescription>

            <CardTitle className="mt-2 text-xl font-semibold tracking-[-0.025em]">
              Staff payroll ledger
            </CardTitle>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-[#7C3AED]" />

            <span className="text-[10px] font-semibold text-[#7C3AED] dark:text-[#a78bfa]">
              {payrollRecords.toLocaleString()} records
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                GH₵
              </span>

              <span className="text-[2.7rem] font-semibold leading-none tracking-[-0.06em] tabular-nums">
                {Math.round(payrollAmount || 0).toLocaleString()}
              </span>
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground">
              Total payroll value on the books
            </p>
          </div>

          <div className="pb-1 text-right">
            <p className="text-[10px] text-muted-foreground">Pending</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-sm font-semibold tabular-nums">
              {pendingPayroll.toLocaleString()}
            </p>
          </div>
        </div>
      </CardHeader>

      {/* MAIN */}
      <CardContent className="flex flex-1 flex-col px-6 pt-6 sm:px-7">
        {/* PAYMENT RAIL */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Processing progress
            </span>

            <span className="text-[10px] font-medium text-muted-foreground">
              {Math.round(processedPct)}% processed
            </span>
          </div>

          <div className="relative h-8 overflow-hidden rounded-xl bg-muted/70">
            <div
              className="absolute inset-y-0 left-0 flex items-center px-3 transition-all"
              style={{
                width: `${processedPct}%`,
                background:
                  "linear-gradient(90deg, #7C3AED 0%, #9B5DE5 100%)",
              }}
            >
              <span className="truncate text-[10px] font-semibold text-white">
                {processedRecords.toLocaleString()} processed
              </span>
            </div>

            <div
              className="absolute inset-y-0 right-0 flex items-center justify-end px-3"
              style={{
                width: `${pendingPct}%`,
                minWidth: pendingPct > 0 ? "96px" : "0px",
              }}
            >
              <span className="truncate text-[10px] font-semibold text-foreground">
                {pendingPayroll.toLocaleString()} pending
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[#7C3AED]" />
              <span className="text-[9px] text-muted-foreground">
                Processed
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[#F4C430]" />
              <span className="text-[9px] text-muted-foreground">
                Pending
              </span>
            </div>
          </div>
        </div>

        {/* SNAPSHOT */}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/50 bg-[#7C3AED]/[0.045] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground">
                Processed
              </span>
              <CheckCircle2 className="size-3.5 text-[#7C3AED]" />
            </div>

            <p className="mt-2 text-lg font-semibold tracking-tight tabular-nums">
              {processedRecords.toLocaleString()}
            </p>

            <p className="mt-1 text-[9px] text-muted-foreground">
              {Math.round(processedPct)}% of records
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-[#F4C430]/[0.08] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground">
                Still pending
              </span>
              <Clock3 className="size-3.5 text-[#D99A00]" />
            </div>

            <p className="mt-2 text-lg font-semibold tracking-tight tabular-nums">
              {pendingPayroll.toLocaleString()}
            </p>

            <p className="mt-1 text-[9px] text-muted-foreground">
              awaiting payment
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-auto pt-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <UsersRound className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Payroll coverage
              </span>
            </div>

            <span className="text-[10px] text-muted-foreground">
              {processedRecords}/{payrollRecords} processed
            </span>
          </div>

          <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              Teaching and non-teaching payroll across staff and teachers.
              Pending records await disbursement before the next run.
            </p>
          </div>
        </div>
      </CardContent>

      {/* FOOTER */}
      <CardFooter className="mt-5 flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-3.5 sm:px-7">
        <span className="text-[10px] text-muted-foreground">
          Payroll disbursement
        </span>

        <span className="text-[10px] font-semibold">
          {pendingPayroll.toLocaleString()} pending staff
        </span>
      </CardFooter>
    </Card>
  )
}
