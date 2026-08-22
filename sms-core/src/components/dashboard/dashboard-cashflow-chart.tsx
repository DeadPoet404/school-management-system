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

export const description = "A stacked bi-weekly treasury cashflow bar chart with 9 periods and 1.5x wide bars"

const chartData = [
  { period: "Jun 1–14", collections: 78000, expenses: 31000 },
  { period: "Jun 15–28", collections: 92000, expenses: 42000 },
  { period: "Jul 1–14", collections: 104000, expenses: 38000 },
  { period: "Jul 15–28", collections: 116000, expenses: 47000 },
  { period: "Aug 1–14", collections: 89000, expenses: 35000 },
  { period: "Aug 15–28", collections: 127000, expenses: 51000 },
  { period: "Sep 1–14", collections: 118000, expenses: 44000 },
  { period: "Sep 15–28", collections: 136000, expenses: 53000 },
  { period: "Oct 1–14", collections: 108000, expenses: 39000 },
  { period: "Oct 15–28", collections: 143000, expenses: 58000 },
  { period: "Nov 1–14", collections: 121000, expenses: 46000 },
  { period: "Nov 15–28", collections: 151000, expenses: 61000 },
]
const chartConfig = {
  collections: {
    label: "Fee Collections",
    color: "#FF5A36", // Mango-Papaya Coral
  },
  expenses: {
    label: "Operating Spend",
    color: "#7C3AED", // Passionfruit Violet
  },
} satisfies ChartConfig

export function ChartBarStacked() {
  const totalCollections = React.useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.collections, 0),
    []
  )
  const totalExpenses = React.useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.expenses, 0),
    []
  )

  return (
    <Card className="h-full flex flex-col justify-between py-0 rounded-2xl sm:rounded-3xl border border-border/60 shadow-xs">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-0!">
          <CardTitle>School Treasury Operations</CardTitle>
          <CardDescription>
            Bi-weekly Cashflow Trajectory across 9 Cycles
          </CardDescription>
        </div>
        <div className="flex">
          <div className="relative z-30 flex flex-1 min-w-[140px] sm:min-w-[170px] flex-col justify-center gap-1 border-t px-6 py-4 text-left sm:border-t-0 sm:border-l sm:px-8 sm:py-6">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <span className="size-2 bg-[#FF5A36] rounded-xs" />
              Fee Collections
            </span>
            <span className="text-lg leading-none font-bold sm:text-2xl tracking-tight text-foreground">
              GH₵{totalCollections.toLocaleString()}
            </span>
          </div>
          <div className="relative z-30 flex flex-1 min-w-[140px] sm:min-w-[170px] flex-col justify-center gap-1 border-t border-l px-6 py-4 text-left sm:border-t-0 sm:px-8 sm:py-6">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <span className="size-2 bg-[#7C3AED] rounded-xs" />
              Operating Spend
            </span>
            <span className="text-lg leading-none font-bold sm:text-2xl tracking-tight text-foreground">
              GH₵{totalExpenses.toLocaleString()}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:px-4 pt-4 pb-4 flex-1 flex flex-col justify-center">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[360px] sm:h-[420px] w-full flex-1"
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
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  formatter={(val, name) => [
                    `GH₵${Number(val).toLocaleString()}`,
                    name === "collections" ? "Fee Collections" : "Operating Spend",
                  ]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {/* Bottom Stack: 1.5x wider (56px) with bottom rounded corners */}
            <Bar
              dataKey="expenses"
              stackId="a"
              fill="var(--color-expenses)"
              radius={[0, 0, 4, 4]}
              barSize={56}
            />
            {/* Top Stack: 1.5x wider (56px) with top rounded corners */}
            <Bar
              dataKey="collections"
              stackId="a"
              fill="var(--color-collections)"
              radius={[4, 4, 0, 0]}
              barSize={56}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
