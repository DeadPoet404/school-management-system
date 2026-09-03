"use client"

import * as React from "react"
import {
  Banknote,
  FileText,
  Receipt,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  useFinanceDashboard,
  type FinanceDashboardData,
} from "@/lib/api/finance"
import { cn } from "@/lib/utils"

const CURRENCY = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
})

const fmtGhs = (value: number) =>
  CURRENCY.format(Number.isFinite(value) ? value : 0)

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const WINDOWS = [30, 90, 180] as const

const chartConfig = {
  collected: {
    label: "Collected",
    color: "#16a34a",
  },
  outflows: {
    label: "Outflows",
    color: "#e11d48",
  },
} satisfies ChartConfig

type IconComponent = React.ComponentType<{ className?: string }>

function sumTrend(
  data: FinanceDashboardData | undefined,
  key: "collected" | "invoiced" | "expenses" | "payroll" | "outflows" | "netCashflow"
) {
  return (data?.trend ?? []).reduce((sum, point) => sum + num(point[key]), 0)
}

function trendHasData(data: FinanceDashboardData | undefined) {
  return (data?.trend ?? []).some(
    (point) =>
      num(point.collected) > 0 ||
      num(point.invoiced) > 0 ||
      num(point.outflows) > 0
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: IconComponent
  label: string
  value: string
  sub: string
  tone: "emerald" | "rose" | "amber" | "ink"
}) {
  const toneClasses = {
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
    ink: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  }[tone]

  return (
    <Card className="h-full rounded-2xl border border-border/60 bg-card shadow-none">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </CardDescription>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground sm:text-[27px]">
            {value}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
            {sub}
          </p>
        </div>

        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            toneClasses
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </CardContent>
    </Card>
  )
}

function FinanceDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[120px] animate-pulse rounded-2xl border border-border/60 bg-muted/40"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-[360px] animate-pulse rounded-2xl border border-border/60 bg-muted/40 lg:col-span-2" />
        <div className="h-[360px] animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[150px] animate-pulse rounded-2xl border border-border/60 bg-muted/40"
          />
        ))}
      </div>
    </div>
  )
}

export default function FinanceDashboard() {
  const [days, setDays] = React.useState<number>(90)
  const { data, isLoading, isError, isFetching, refetch } =
    useFinanceDashboard(days)

  const totals = data?.totals
  const counts = data?.counts

  // Window (trend) figures — internally consistent with the chart below.
  const windowCollected = sumTrend(data, "collected")
  const windowExpenses = sumTrend(data, "expenses")
  const windowPayroll = sumTrend(data, "payroll")
  const windowOutflows = sumTrend(data, "outflows")
  const windowNet = sumTrend(data, "netCashflow")

  // Lifetime figures straight from the backend summary.
  const lifetimeOutstanding = num(totals?.outstanding)
  const lifetimeInvoiced = num(totals?.invoiced)
  const lifetimeInvoicePayments = num(totals?.invoicePayments)
  const coveragePct =
    lifetimeInvoiced > 0
      ? Math.min(
          100,
          Math.round((lifetimeInvoicePayments / lifetimeInvoiced) * 100)
        )
      : 0

  const hasTrend = trendHasData(data)
  const trendEmpty =
    !isLoading && !isError && data && !trendHasData(data)

  if (isLoading) return <FinanceDashboardSkeleton />

  if (isError) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TrendingDown className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold">Unable to load finance data</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Check that the backend is reachable and your account has finance
          access, then try again.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          Retry
        </button>
      </div>
    )
  }

  const netPositive = windowNet >= 0

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={netPositive ? TrendingUp : TrendingDown}
          label="Net Cashflow"
          value={fmtGhs(windowNet)}
          sub={`last ${days} days · collected − outflows`}
          tone={netPositive ? "emerald" : "rose"}
        />

        <KpiCard
          icon={Wallet}
          label="Cash Collected"
          value={fmtGhs(windowCollected)}
          sub={`last ${days} days · ${num(counts?.collections) || "—"} receipts all-time`}
          tone="emerald"
        />

        <KpiCard
          icon={ReceiptText}
          label="Outstanding Receivables"
          value={fmtGhs(lifetimeOutstanding)}
          sub={`${num(counts?.openInvoices) || 0} open of ${num(counts?.invoices) || 0} invoices`}
          tone="amber"
        />

        <KpiCard
          icon={Banknote}
          label="Outflows"
          value={fmtGhs(windowOutflows)}
          sub={`last ${days} days · expenses ${fmtGhs(windowExpenses)} · payroll ${fmtGhs(windowPayroll)}`}
          tone="rose"
        />
      </div>

      {/* ── Cashflow chart + receivables side panel ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="rounded-2xl border border-border/60 bg-card shadow-none lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 px-4 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">
                Cashflow
              </CardTitle>
              <CardDescription>
                Collections vs expenses + payroll — last {days} days.
                {isFetching ? " Refreshing…" : ""}
              </CardDescription>
            </div>

            <div className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5">
              {WINDOWS.map((window) => (
                <button
                  key={window}
                  type="button"
                  onClick={() => setDays(window)}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
                    days === window
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {window}d
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="px-2 pt-2 pb-3 sm:px-3">
            {trendEmpty || !hasTrend ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-1 px-6 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No finance activity in this window yet
                </p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Invoices, collections or expenses recorded in the last{" "}
                  {days} days will appear here.
                </p>
              </div>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="h-[300px] w-full lg:h-[320px]"
              >
                <BarChart
                  accessibilityLayer
                  data={data?.trend ?? []}
                  margin={{ left: 4, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={40}
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <ChartTooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    content={
                      <ChartTooltipContent
                        className="w-[190px]"
                        labelFormatter={(value: unknown) =>
                          new Date(String(value)).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        }
                        formatter={(value) => (
                          <span className="font-mono text-xs font-medium tabular-nums">
                            {fmtGhs(Number(value))}
                          </span>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="collected"
                    fill="var(--color-collected)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="outflows"
                    fill="var(--color-outflows)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card shadow-none">
          <CardHeader className="px-4 pt-5 sm:px-6">
            <CardTitle className="text-base font-semibold tracking-tight">
              Receivables
            </CardTitle>
            <CardDescription>All-time billing position</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-5 px-4 sm:px-6">
            <div>
              <p className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {fmtGhs(lifetimeOutstanding)}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Open balance to collect
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  Collection coverage
                </span>
                <span className="font-semibold text-foreground">
                  {coveragePct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${coveragePct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                {fmtGhs(lifetimeInvoicePayments)} of {fmtGhs(lifetimeInvoiced)}{" "}
                invoiced collected
              </p>
            </div>

            <div className="mt-auto space-y-2 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Paid invoices</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {num(counts?.paidInvoices) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Partial</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {num(counts?.partialInvoices) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Open</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {num(counts?.openInvoices) || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Billing / payroll / expenses snapshot ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Card className="rounded-2xl border border-border/60 bg-card shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Billing
              </CardDescription>
              <p className="mt-2 truncate text-xl font-bold tracking-tight">
                {fmtGhs(lifetimeInvoiced)}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
                {num(counts?.invoices) || 0} invoices issued all-time
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <FileText className="h-4.5 w-4.5" />
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Payroll
              </CardDescription>
              <p className="mt-2 truncate text-xl font-bold tracking-tight">
                {fmtGhs(num(totals?.payroll))}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
                {num(counts?.pendingPayroll) || 0} pending ·{" "}
                {num(counts?.payroll) || 0} records
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              <WalletCards className="h-4.5 w-4.5" />
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Operating Expenses
              </CardDescription>
              <p className="mt-2 truncate text-xl font-bold tracking-tight">
                {fmtGhs(num(totals?.expenses))}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
                {num(counts?.expenses) || 0} expense records all-time
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
              <Receipt className="h-4.5 w-4.5" />
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
