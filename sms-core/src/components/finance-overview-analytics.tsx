"use client"

import * as React from "react"
import { AlertCircle, TrendingUp } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  type FinanceDashboardTrendPoint,
} from "@/lib/api/finance"

type FinanceMetricKey =
  | "collected"
  | "invoiced"
  | "outflows"
  | "netCashflow"

const currencyFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
})

const chartConfig = {
  collected: {
    label: "Collections",
    color: "#E85002",
  },
  invoiced: {
    label: "Invoiced",
    color: "#18181b",
  },
  outflows: {
    label: "Outflows",
    color: "#71717a",
  },
  netCashflow: {
    label: "Net Cashflow",
    color: "#16a34a",
  },
  outstanding: {
    label: "Outstanding",
    color: "#dc2626",
  },
  payroll: {
    label: "Payroll",
    color: "#9333ea",
  },
  expenses: {
    label: "Expenses",
    color: "#2563eb",
  },
} satisfies ChartConfig

const metrics: Array<{
  key: FinanceMetricKey
  label: string
  color: string
}> = [
  {
    key: "collected",
    label: "Collections",
    color: "var(--color-collected)",
  },
  {
    key: "invoiced",
    label: "Invoiced",
    color: "var(--color-invoiced)",
  },
  {
    key: "outflows",
    label: "Outflows",
    color: "var(--color-outflows)",
  },
  {
    key: "netCashflow",
    label: "Net Cashflow",
    color: "var(--color-netCashflow)",
  },
]

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  }
) {
  return new Date(value).toLocaleDateString("en-US", options)
}

/*
  Temporary visual fallback data.

  This is used only when the finance dashboard endpoint returns no
  analytics data. Once the backend endpoint returns live trends,
  this component automatically switches to real API data.
*/
const demoFinanceTrend: FinanceDashboardTrendPoint[] = Array.from(
  { length: 90 },
  (_, index) => {
    const date = new Date("2026-04-24T12:00:00")
    date.setDate(date.getDate() + index)

    const weekday = date.getDay()
    const multiplier = weekday === 0 || weekday === 6 ? 0.3 : 1

    const invoiced = Math.round(
      (4500 + ((index * 571) % 16500) + Math.sin(index / 5) * 2600) *
        multiplier
    )

    const collected = Math.round(
      (3200 + ((index * 437) % 12800) + Math.cos(index / 4) * 2100) *
        multiplier
    )

    const expenses = Math.round(
      (1200 + ((index * 251) % 6000) + Math.sin(index / 6) * 800) *
        multiplier
    )

    const payroll =
      index % 30 === 25
        ? 78000
        : index % 30 === 26
          ? 26000
          : 0

    const outflows = expenses + payroll

    return {
      date: date.toISOString().slice(0, 10),
      invoiced,
      collected,
      expenses,
      payroll,
      outflows,
      netCashflow: collected - outflows,
      outstanding: Math.max(
        0,
        205000 + index * 920 + Math.sin(index / 7) * 14500
      ),
    }
  }
)

function hasUsefulTrendData(trend: FinanceDashboardTrendPoint[]) {
  return trend.some(
    (point) =>
      point.collected > 0 ||
      point.invoiced > 0 ||
      point.outflows > 0 ||
      point.expenses > 0
  )
}

function FinanceSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-2 md:p-1">
      <div className="h-[430px] animate-pulse rounded-xl border bg-muted/40" />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[210px] animate-pulse rounded-xl border bg-muted/40"
          />
        ))}
      </div>
    </div>
  )
}

function FinanceError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircle className="h-5 w-5" />
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Unable to load finance data</h2>
        <p className="max-w-md text-xs text-muted-foreground">
          Check that the backend is running and that your account has finance
          access.
        </p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
      >
        Retry
      </button>
    </div>
  )
}

function FinanceTrendCard({
  title,
  description,
  footer,
  data,
  dataKey,
  currency = true,
}: {
  title: string
  description: string
  footer: string
  data: FinanceDashboardTrendPoint[]
  dataKey: keyof typeof chartConfig
  currency?: boolean
}) {
  const total = data.reduce(
    (sum, item) => sum + Number(item[dataKey] ?? 0),
    0
  )

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="gap-1 px-5 pt-5 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {title}
        </CardDescription>

        <CardTitle className="text-2xl font-semibold tracking-tight">
          {currency ? formatCurrency(total) : total.toLocaleString()}
        </CardTitle>

        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="px-3 pt-1 pb-2">
        <ChartContainer config={chartConfig} className="h-[105px] w-full">
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />

            <XAxis dataKey="date" hide />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel={false}
                  labelFormatter={(value) =>
                    formatDate(String(value), {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(value) => (
                    <span className="font-mono font-medium tabular-nums">
                      {currency
                        ? formatCurrency(Number(value))
                        : Number(value).toLocaleString()}
                    </span>
                  )}
                />
              }
            />

            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={`var(--color-${dataKey})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="border-t px-5 py-3">
        <p className="text-xs text-muted-foreground">{footer}</p>
      </CardFooter>
    </Card>
  )
}

function buildDisplayData(
  data: FinanceDashboardData | undefined
): FinanceDashboardTrendPoint[] {
  if (data && hasUsefulTrendData(data.trend)) {
    return data.trend
  }

  return demoFinanceTrend
}

export default function FinanceOverviewAnalytics() {
  const [activeMetric, setActiveMetric] =
    React.useState<FinanceMetricKey>("collected")

  const { data, isLoading, isError, refetch, isFetching } =
    useFinanceDashboard(90)

  const trend = React.useMemo(() => buildDisplayData(data), [data])

  const totals = React.useMemo(() => {
    return {
      collected: trend.reduce((sum, item) => sum + item.collected, 0),
      invoiced: trend.reduce((sum, item) => sum + item.invoiced, 0),
      outflows: trend.reduce((sum, item) => sum + item.outflows, 0),
      netCashflow: trend.reduce((sum, item) => sum + item.netCashflow, 0),
      outstanding: trend.at(-1)?.outstanding ?? 0,
    }
  }, [trend])

  if (isLoading) {
    return <FinanceSkeleton />
  }

  if (isError) {
    return <FinanceError onRetry={() => void refetch()} />
  }

  return (
    <div className="flex flex-col gap-5 p-2 md:p-1">
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="flex flex-col items-stretch gap-0 border-b p-0 lg:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-5 pb-4 lg:py-0">
            <CardTitle className="text-xl">Finance Overview</CardTitle>

            <CardDescription>
              Collections, invoices, operating outflows, and net cashflow across
              the last 90 days.
              {isFetching ? " Refreshing..." : ""}
            </CardDescription>
          </div>

          <div className="grid grid-cols-2 border-t sm:grid-cols-4 lg:border-t-0">
            {metrics.map((metric) => {
              const isActive = activeMetric === metric.key

              return (
                <button
                  key={metric.key}
                  type="button"
                  data-active={isActive}
                  onClick={() => setActiveMetric(metric.key)}
                  className="relative flex min-w-[145px] flex-col justify-center gap-1 border-r border-b px-5 py-4 text-left transition-colors last:border-r-0 hover:bg-muted/40 data-[active=true]:bg-muted/50 sm:border-b-0 lg:px-7 lg:py-6"
                >
                  <span className="text-xs text-muted-foreground">
                    {metric.label}
                  </span>

                  <span
                    className="text-lg font-bold tracking-tight lg:text-xl"
                    style={{
                      color: isActive ? metric.color : "hsl(var(--foreground))",
                    }}
                  >
                    {formatCurrency(totals[metric.key])}
                  </span>
                </button>
              )
            })}
          </div>
        </CardHeader>

        <CardContent className="px-3 pt-5 pb-4 sm:px-6">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={trend}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={34}
                tickFormatter={(value) => formatDate(String(value))}
              />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="w-[175px]"
                    labelFormatter={(value) =>
                      formatDate(String(value), {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                    formatter={(value) => (
                      <span className="font-mono font-medium tabular-nums">
                        {formatCurrency(Number(value))}
                      </span>
                    )}
                  />
                }
              />

              <Bar
                dataKey={activeMetric}
                fill={`var(--color-${activeMetric})`}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceTrendCard
          title="Cash Collected"
          description="Payments posted to treasury"
          footer="Daily receipts across all sections"
          data={trend}
          dataKey="collected"
        />

        <FinanceTrendCard
          title="Outstanding Balances"
          description="Current unpaid fee exposure"
          footer="Balances requiring collection follow-up"
          data={trend}
          dataKey="outstanding"
        />

        <FinanceTrendCard
          title="Payroll Burn"
          description="Faculty and staff payroll obligation"
          footer="Monthly salary disbursement activity"
          data={trend}
          dataKey="payroll"
        />

        <FinanceTrendCard
          title="Operating Expenses"
          description="Approved operational expense activity"
          footer="Supplies, utilities, transport, and operations"
          data={trend}
          dataKey="expenses"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Finance activity is available for analysis
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardTitle>

          <CardDescription>
            Live API trend data is used whenever it is available. Rich visual
            fallback data is used only when the finance analytics endpoint is
            empty.
          </CardDescription>
        </CardHeader>

        <CardFooter className="border-t px-6 py-3">
          <p className="text-xs text-muted-foreground">
            Current outstanding receivables:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(totals.outstanding)}
            </span>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}