"use client"

import * as React from "react"
import {
  ArrowUpRight,
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

const payroll = {
  monthlyObligation: 374200,
  paid: 331000,
  pending: 43200,

  teachers: {
    headcount: 86,
    paid: 79,
    pending: 7,
    amount: 289400,
  },

  nonTeaching: {
    headcount: 32,
    paid: 30,
    pending: 2,
    amount: 84800,
  },
}

export function DashboardPayrollCard() {
  const coverageRatio = 689372 / payroll.monthlyObligation

  const paidPercentage =
    (payroll.paid / payroll.monthlyObligation) * 100

  const pendingPercentage =
    (payroll.pending / payroll.monthlyObligation) * 100

  const totalStaff =
    payroll.teachers.headcount + payroll.nonTeaching.headcount

  const totalPaidStaff =
    payroll.teachers.paid + payroll.nonTeaching.paid

  const totalPendingStaff =
    payroll.teachers.pending + payroll.nonTeaching.pending

  return (
    <Card className="flex h-full min-h-[430px] flex-col overflow-hidden rounded-[24px] border border-border/60 bg-card py-0 shadow-sm">

      {/* ───────────────── HEADER ───────────────── */}

      <CardHeader className="px-6 pb-0 pt-6 sm:px-7 sm:pt-7">

        <div className="flex items-start justify-between">

          <div>
            <CardDescription className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
              <Banknote className="size-3.5 text-[#FF5A36]" />
              Payroll
            </CardDescription>

            <CardTitle className="mt-2 text-xl font-semibold tracking-[-0.025em]">
              Monthly staff obligation
            </CardTitle>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-emerald-500" />

            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              On track
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
                {payroll.monthlyObligation.toLocaleString()}
              </span>

            </div>

            <p className="mt-2 text-[10px] text-muted-foreground">
              Total payroll obligation this month
            </p>

          </div>

          <div className="pb-1 text-right">

            <p className="text-[10px] text-muted-foreground">
              Coverage
            </p>

            <p className="mt-1 flex items-center justify-end gap-1 text-sm font-semibold tabular-nums">
              {coverageRatio.toFixed(2)}×
              <ArrowUpRight className="size-3.5 text-emerald-500" />
            </p>

          </div>

        </div>

      </CardHeader>

      {/* ───────────────── MAIN ───────────────── */}

      <CardContent className="flex flex-1 flex-col px-6 pt-6 sm:px-7">

        {/* PAYMENT RAIL */}

        <div>

          <div className="mb-2.5 flex items-center justify-between">

            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Payment progress
            </span>

            <span className="text-[10px] font-medium text-muted-foreground">
              {Math.round(paidPercentage)}% processed
            </span>

          </div>

          <div className="relative h-8 overflow-hidden rounded-xl bg-muted/70">

            {/* PAID */}

            <div
              className="absolute inset-y-0 left-0 flex items-center px-3 transition-all"
              style={{
                width: `${paidPercentage}%`,
                background:
                  "linear-gradient(90deg, #7C3AED 0%, #9B5DE5 100%)",
              }}
            >

              <span className="truncate text-[10px] font-semibold text-white">
                GH₵{payroll.paid.toLocaleString()} paid
              </span>

            </div>

            {/* PENDING */}

            <div
              className="absolute inset-y-0 right-0 flex items-center justify-end px-3"
              style={{
                width: `${pendingPercentage}%`,
                minWidth: "92px",
              }}
            >

              <span className="truncate text-[10px] font-semibold text-foreground">
                GH₵{payroll.pending.toLocaleString()}
              </span>

            </div>

          </div>

          <div className="mt-2 flex items-center justify-between">

            <div className="flex items-center gap-1.5">

              <span className="size-2 rounded-sm bg-[#7C3AED]" />

              <span className="text-[9px] text-muted-foreground">
                Paid
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

        {/* MONEY SNAPSHOT */}

        <div className="mt-7 grid grid-cols-2 gap-3">

          <div className="rounded-2xl border border-border/50 bg-[#7C3AED]/[0.045] p-4">

            <div className="flex items-center justify-between">

              <span className="text-[10px] font-medium text-muted-foreground">
                Paid
              </span>

              <CheckCircle2 className="size-3.5 text-[#7C3AED]" />

            </div>

            <p className="mt-2 text-lg font-semibold tracking-tight tabular-nums">
              GH₵{payroll.paid.toLocaleString()}
            </p>

            <p className="mt-1 text-[9px] text-muted-foreground">
              {Math.round(paidPercentage)}% of obligation
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
              GH₵{payroll.pending.toLocaleString()}
            </p>

            <p className="mt-1 text-[9px] text-muted-foreground">
              {totalPendingStaff} staff awaiting payment
            </p>

          </div>

        </div>

        {/* STAFF BREAKDOWN */}

        <div className="mt-auto pt-6">

          <div className="mb-3 flex items-center justify-between">

            <div className="flex items-center gap-1.5">

              <UsersRound className="size-3.5 text-muted-foreground" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Staff processing
              </span>

            </div>

            <span className="text-[10px] text-muted-foreground">
              {totalPaidStaff}/{totalStaff} paid
            </span>

          </div>

          <div className="space-y-3">

            {/* TEACHING */}

            <div>

              <div className="mb-1.5 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <span className="size-2 rounded-full bg-[#FF5A36]" />

                  <span className="text-[10px] font-medium">
                    Teaching
                  </span>

                </div>

                <span className="text-[10px] font-semibold tabular-nums">
                  {payroll.teachers.paid}/{payroll.teachers.headcount}
                </span>

              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">

                <div
                  className="h-full rounded-full bg-[#FF5A36]"
                  style={{
                    width: `${
                      (payroll.teachers.paid /
                        payroll.teachers.headcount) *
                      100
                    }%`,
                  }}
                />

              </div>

            </div>

            {/* NON TEACHING */}

            <div>

              <div className="mb-1.5 flex items-center justify-between">

                <div className="flex items-center gap-2">

                  <span className="size-2 rounded-full bg-[#00A896]" />

                  <span className="text-[10px] font-medium">
                    Non-teaching
                  </span>

                </div>

                <span className="text-[10px] font-semibold tabular-nums">
                  {payroll.nonTeaching.paid}/
                  {payroll.nonTeaching.headcount}
                </span>

              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">

                <div
                  className="h-full rounded-full bg-[#00A896]"
                  style={{
                    width: `${
                      (payroll.nonTeaching.paid /
                        payroll.nonTeaching.headcount) *
                      100
                    }%`,
                  }}
                />

              </div>

            </div>

          </div>

        </div>

      </CardContent>

      {/* ───────────────── FOOTER ───────────────── */}

      <CardFooter className="mt-5 flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-3.5 sm:px-7">

        <span className="text-[10px] text-muted-foreground">
          Next payroll review
        </span>

        <span className="text-[10px] font-semibold">
          {totalPendingStaff} pending staff
        </span>

      </CardFooter>

    </Card>
  )
}