"use client"

import { AlertCircle } from "lucide-react"
import { UniversalBarChart, type MetricConfig } from "@/components/universal-bar-chart"
import { UniversalAreaMiniChart } from "@/components/universal-area-mini-chart"
import { UniversalLineMiniChart } from "@/components/universal-line-mini-chart"
import { UniversalBarMiniChart } from "@/components/universal-bar-mini-chart"
import { useFinanceDashboard, type FinanceDashboardTotals } from "@/lib/api/finance"

const financeMetrics: MetricConfig[] = [
  { key: "collected", label: "Collections", color: "#E85002" },
  { key: "invoiced", label: "Invoiced", color: "#18181b" },
  { key: "outflows", label: "Outflows", color: "#71717a" },
  { key: "netCashflow", label: "Net Cashflow", color: "#16a34a" },
]

const currencyFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
})

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount)
}

function FinanceDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-2 md:p-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[112px] bg-white rounded-xl border border-zinc-200 p-4 shadow-sm animate-pulse" />
        ))}
      </div>
      <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm h-[430px] animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[220px] bg-white rounded-xl border border-zinc-200 p-4 shadow-sm animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function FinanceDashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-900">Unable to load finance dashboard</h2>
        <p className="max-w-md text-xs text-zinc-500">
          The finance dashboard is now wired to the live finance API. Check that the backend is running and that your account has finance access.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        Retry
      </button>
    </div>
  )
}

function KpiCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string
  value: string
  helper: string
  tone?: "orange" | "green" | "red" | "neutral"
}) {
  const toneClass = {
    orange: "text-[#E85002]",
    green: "text-emerald-600",
    red: "text-rose-600",
    neutral: "text-zinc-900",
  }[tone]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-zinc-400">{helper}</p>
    </div>
  )
}

function FinanceKpiGrid({ totals }: { totals: FinanceDashboardTotals }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="Cash Collected"
        value={formatCurrency(totals.collected)}
        helper="Verified collections posted to treasury"
        tone="orange"
      />
      <KpiCard
        label="Outstanding Receivables"
        value={formatCurrency(totals.outstanding)}
        helper="Invoice balances not yet cleared"
        tone={totals.outstanding > 0 ? "red" : "green"}
      />
      <KpiCard
        label="Operating Outflows"
        value={formatCurrency(totals.outflows)}
        helper="Expenses plus current payroll obligation"
      />
      <KpiCard
        label="Net Cashflow"
        value={formatCurrency(totals.netCashflow)}
        helper="Collections less expenses and payroll"
        tone={totals.netCashflow >= 0 ? "green" : "red"}
      />
    </div>
  )
}

export default function FinanceOverviewAnalytics() {
  const { data, isLoading, isError, refetch, isFetching } = useFinanceDashboard(90)

  if (isLoading) return <FinanceDashboardSkeleton />
  if (isError || !data) return <FinanceDashboardError onRetry={() => void refetch()} />

  return (
    <div className="flex flex-col gap-4 p-2 md:p-1">
      <FinanceKpiGrid totals={data.totals} />

      <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
        <UniversalBarChart
          title="Finance Overview"
          description={`Live collections, invoices, outflows, and net cashflow across the last ${data.windowDays} days.${isFetching ? " Refreshing..." : ""}`}
          data={data.trend}
          metrics={financeMetrics}
          defaultMetricKey="collected"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <UniversalAreaMiniChart
          title="Collections vs Outflows"
          subtitle={`${data.counts.collections.toLocaleString()} receipts against ${data.counts.expenses.toLocaleString()} expense logs`}
          data={data.trend}
          dataKey="collected"
          secondaryDataKey="outflows"
          color="#E85002"
          secondaryColor="#18181b"
          height={135}
        />

        <UniversalLineMiniChart
          title="Outstanding Balances"
          subtitle={`${data.counts.openInvoices.toLocaleString()} open invoice records`}
          data={data.trend}
          dataKey="outstanding"
          color="#18181b"
          height={135}
        />

        <UniversalBarMiniChart
          title="Payroll Burn"
          subtitle={`${data.counts.pendingPayroll.toLocaleString()} payroll allocations pending`}
          data={data.trend}
          dataKey="payroll"
          color="#E85002"
          height={135}
        />

        <UniversalBarMiniChart
          title="Expense Outflows"
          subtitle={`${data.counts.expenses.toLocaleString()} operational expense records`}
          data={data.trend}
          dataKey="expenses"
          color="#18181b"
          height={135}
        />
      </div>
    </div>
  )
}
