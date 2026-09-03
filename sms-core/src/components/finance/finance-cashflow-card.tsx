"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { FinanceDashboardTrendPoint } from "@/lib/api/finance"

const CYCLES = 9

const chartConfig = {
  collected: {
    label: "Fee Collections",
    color: "#FF5A36", // Mango-Papaya Coral
  },
  expenses: {
    label: "Operating Spend",
    color: "#7C3AED", // Passionfruit Violet
  },
} satisfies ChartConfig

interface FinanceCashflowCardProps {
  trend: FinanceDashboardTrendPoint[]
  days: number
}

function fmtShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })
}

function ghs(value: number) {
  return `GH₵${Math.round(value || 0).toLocaleString()}`
}

interface CycleRow {
  period: string
  collected: number
  expenses: number
}

function bucketTrend(
  trend: FinanceDashboardTrendPoint[],
  cycles: number,
): CycleRow[] {
  if (trend.length === 0) {
    return [{ period: "No data", collected: 0, expenses: 0 }]
  }

  const size = Math.max(1, Math.ceil(trend.length / cycles))
  const rows: CycleRow[] = []

  for (let index = 0; index < trend.length; index += size) {
    const slice = trend.slice(index, index + size)
    rows.push({
      period: fmtShortDate(slice[0].date),
      collected: slice.reduce(
        (sum, point) => sum + Number(point.collected || 0),
        0,
      ),
      expenses: slice.reduce(
        (sum, point) => sum + Number(point.expenses || 0),
        0,
      ),
    })
  }

  return rows
}

export function FinanceCashflowCard({
  trend,
  days,
}: FinanceCashflowCardProps) {
  const chartData = React.useMemo(
    () => bucketTrend(trend, CYCLES),
    [trend],
  )

  const totalCollected = React.useMemo(
    () => chartData.reduce((acc, row) => acc + row.collected, 0),
    [chartData],
  )

  const totalExpenses = React.useMemo(
    () => chartData.reduce((acc, row) => acc + row.expenses, 0),
    [chartData],
  )

  const hasData = chartData.some(
    (row) => row.collected > 0 || row.expenses > 0,
  )

  return (
    <Card className="flex h-full flex-col justify-between rounded-2xl border border-border/60 py-0 shadow-xs sm:rounded-3xl">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 pt-4 sm:py-0!">
          <CardTitle>Finance Operations</CardTitle>
          <CardDescription>
            Cashflow trajectory across {CYCLES} cycles · last {days} days
          </CardDescription>
        </div>
        <div className="flex">
          <div className="relative z-30 flex flex-1 min-w-[140px] flex-col justify-center gap-1 border-t px-6 py-4 text-left sm:min-w-[170px] sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-xs bg-[#FF5A36]" />
              Fee Collections
            </span>
            <span className="text-lg font-bold leading-none tracking-tight text-foreground sm:text-2xl tabular-nums">
              {ghs(totalCollected)}
            </span>
          </div>
          <div className="relative z-30 flex flex-1 min-w-[140px] flex-col justify-center gap-1 border-l border-t px-6 py-4 text-left sm:min-w-[170px] sm:px-8 sm:py-6">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-xs bg-[#7C3AED]" />
              Operating Spend
            </span>
            <span className="text-lg font-bold leading-none tracking-tight text-foreground sm:text-2xl tabular-nums">
              {ghs(totalExpenses)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-center px-2 pb-4 pt-4 sm:px-4">
        {hasData ? (
          <ChartContainer
            config={chartConfig}
            className="h-[360px] w-full flex-1 sm:h-[420px]"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 6,
                right: 6,
                top: 16,
                bottom: 4,
              }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                opacity={0.25}
              />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dashed"
                    formatter={(value, name) => [
                      ghs(Number(value)),
                      name === "collected"
                        ? "Fee Collections"
                        : "Operating Spend",
                    ]}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="expenses"
                stackId="a"
                fill="var(--color-expenses)"
                radius={[0, 0, 4, 4]}
                barSize={56}
              />
              <Bar
                dataKey="collected"
                stackId="a"
                fill="var(--color-collected)"
                radius={[4, 4, 0, 0]}
                barSize={56}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-foreground">
              No finance activity in the last {days} days
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Fee collections and operating spend recorded in this window
              will appear here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
