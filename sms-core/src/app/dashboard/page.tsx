"use client"

import * as React from "react"

import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"
import { DashboardTreasuryCard } from "@/components/dashboard/dashboard-treasury-card"
import { ChartBarStacked } from "@/components/dashboard/dashboard-cashflow-chart"
import { DashboardReceivablesCard } from "@/components/dashboard/dashboard-receivables-card"
import { DashboardAttendanceCard } from "@/components/dashboard/dashboard-attendance-card"
import { DashboardStudentsCard } from "@/components/dashboard/dashboard-students-card"
import { DashboardPayrollCard } from "@/components/dashboard/dashboard-payroll-card"
import { useDashboardData } from "@/hooks/use-dashboard-data"

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardData()

  const dashboardTotals = data?.summary.totals
  const expenseBreakdown = data?.expenseBreakdown

  const totalRevenue = dashboardTotals?.collections ?? 0
  const totalInvoiced = dashboardTotals?.invoiced ?? 0
  const spentBudget =
    expenseBreakdown?.categories.reduce(
      (total, category) => total + category.total,
      0,
    ) ?? 0

  const totalBudget = Math.max(totalInvoiced, spentBudget)

  return (
    <div className="w-full px-2 py-3 sm:px-4">
      <DashboardGreeting
        category="School Operations"
        title="Dashboard"
      />

      {isLoading ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          Loading dashboard data…
        </div>
      ) : null}

      {isError ? (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div>
            <p className="font-medium">Dashboard data could not be loaded.</p>
            <p className="mt-1 text-muted-foreground">
              {error.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="shrink-0 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-5 sm:gap-6">
        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:h-[620px] lg:grid-cols-12">
          <div className="flex min-h-0 flex-col lg:col-span-3">
            <DashboardTreasuryCard
              totalRevenue={totalRevenue}
              totalInvoiced={totalInvoiced}
              spentBudget={spentBudget}
              totalBudget={totalBudget}
              onCollectPayment={() =>
                window.location.assign("/finance")
              }
              onIssueInvoice={() =>
                window.location.assign("/finance")
              }
            />
          </div>

          <div className="flex min-h-0 flex-col lg:col-span-6">
            <ChartBarStacked
              collections={data?.collectionsByChannel}
              expenses={data?.expenseBreakdown}
            />
          </div>

          <div className="flex min-h-0 flex-col lg:col-span-3">
            <DashboardReceivablesCard
              aging={data?.receivablesAging}
              debtors={data?.topDebtors}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
          <div className="min-w-0">
            <DashboardAttendanceCard
              attendance={data?.attendanceByClass}
            />
          </div>

          <div className="min-w-0">
            <DashboardStudentsCard
              enrollment={data?.enrollmentDistribution}
            />
          </div>

          <div className="min-w-0">
            <DashboardPayrollCard
              payroll={data?.payrollSummary}
            />
          </div>
        </section>

      </div>
    </div>
  )
}
