"use client"

import * as React from "react"

import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"
import { FinanceTreasuryCard } from "@/components/finance/finance-treasury-card"
import { FinanceCashflowCard } from "@/components/finance/finance-cashflow-card"
import { FinanceReceivablesCard } from "@/components/finance/finance-receivables-card"
import { FinanceBillingDonutCard } from "@/components/finance/finance-billing-donut-card"
import { FinanceExpensesCard } from "@/components/finance/finance-expenses-card"
import { FinancePayrollCard } from "@/components/finance/finance-payroll-card"
import { useFinanceDashboard } from "@/lib/api/finance"

// Chart window: the finance backend builds the daily trend for this many
// days. Kept at 90 (a school term) — label stays honest wherever shown.
const DASHBOARD_DAYS = 90

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function FinanceDashboard() {
  const dashboard = useFinanceDashboard(DASHBOARD_DAYS)

  const totals = dashboard.data?.totals
  const counts = dashboard.data?.counts
  const trend = dashboard.data?.trend ?? []

  const invoiced = num(totals?.invoiced)
  const collected = num(totals?.collected)
  const invoicePayments = num(totals?.invoicePayments)
  const coveragePct =
    invoiced > 0
      ? Math.min(Math.round((invoicePayments / invoiced) * 100), 100)
      : 0

  if (dashboard.isLoading) {
    return (
      <div className="w-full px-2 py-3 sm:px-4">
        <DashboardGreeting
          category="School Finance"
          title="Dashboard"
        />

        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          Loading finance dashboard…
        </div>
      </div>
    )
  }

  if (dashboard.isError) {
    return (
      <div className="w-full px-2 py-3 sm:px-4">
        <DashboardGreeting
          category="School Finance"
          title="Dashboard"
        />

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Finance dashboard could not be loaded.</p>
            <p className="mt-1 text-muted-foreground">
              Check the connection and try again.
            </p>
          </div>

          <button
            type="button"
            onClick={() => dashboard.refetch()}
            className="shrink-0 self-start rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted sm:self-auto"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-2 py-3 sm:px-4">
      <DashboardGreeting
        category="School Finance"
        title="Dashboard"
      />

      <div className="mt-6 flex flex-col gap-5 sm:gap-6">
        {/* Hero row — mirrors the main dashboard 3 / 6 / 3 grid */}
        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:h-[620px] lg:grid-cols-12">
          <div className="flex min-h-0 flex-col lg:col-span-3">
            <FinanceTreasuryCard
              totalCollected={collected}
              totalInvoiced={invoiced}
              coveragePct={coveragePct}
              totalCollectionsCount={num(counts?.collections)}
            />
          </div>

          <div className="flex min-h-0 flex-col lg:col-span-6">
            <FinanceCashflowCard
              trend={trend}
              days={DASHBOARD_DAYS}
            />
          </div>

          <div className="flex min-h-0 flex-col lg:col-span-3">
            <FinanceReceivablesCard
              outstanding={num(totals?.outstanding)}
              invoicePayments={invoicePayments}
              invoiced={invoiced}
              openInvoices={num(counts?.openInvoices)}
              paidInvoices={num(counts?.paidInvoices)}
              partialInvoices={num(counts?.partialInvoices)}
              totalInvoices={num(counts?.invoices)}
            />
          </div>
        </section>

        {/* Snapshot row — mirrors the main dashboard 3-up grid */}
        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
          <div className="min-w-0">
            <FinanceBillingDonutCard
              totalInvoices={num(counts?.invoices)}
              paidInvoices={num(counts?.paidInvoices)}
              partialInvoices={num(counts?.partialInvoices)}
              openInvoices={num(counts?.openInvoices)}
            />
          </div>

          <div className="min-w-0">
            <FinanceExpensesCard
              totalExpenses={num(totals?.expenses)}
              totalExpensesCount={num(counts?.expenses)}
            />
          </div>

          <div className="min-w-0">
            <FinancePayrollCard
              payrollAmount={num(totals?.payroll)}
              payrollRecords={num(counts?.payroll)}
              pendingPayroll={num(counts?.pendingPayroll)}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
