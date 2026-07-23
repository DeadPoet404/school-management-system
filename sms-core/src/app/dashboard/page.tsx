"use client"

import * as React from "react"
import { TrendingUp } from "lucide-react"
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

type DashboardChartPoint = {
  date: string
  collections: number
  attendance: number
  assessments: number
  enrollment: number
}

const chartConfig = {
  collections: {
    label: "Fee Collections",
    color: "#E85002",
  },
  attendance: {
    label: "Average Attendance",
    color: "#2563eb",
  },
  assessments: {
    label: "Assessment Activity",
    color: "#18181b",
  },
  enrollment: {
    label: "Student Enrolment",
    color: "#16a34a",
  },
} satisfies ChartConfig

const metrics = [
  {
    key: "collections",
    label: "Fee Collections",
    color: "var(--color-collections)",
  },
  {
    key: "attendance",
    label: "Average Attendance",
    color: "var(--color-attendance)",
  },
  {
    key: "assessments",
    label: "Assessment Activity",
    color: "var(--color-assessments)",
  },
  {
    key: "enrollment",
    label: "Student Enrolment",
    color: "var(--color-enrollment)",
  },
] as const

function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString(
    "en-US",
    options ?? {
      month: "short",
      day: "numeric",
    }
  )
}

/*
  Temporary presentation data.

  This is deliberately separate from your database seed. It allows us
  to perfect the visual dashboard first, then replace these values with
  API analytics data without redesigning the UI.
*/
const chartData: DashboardChartPoint[] = Array.from(
  { length: 90 },
  (_, index) => {
    const date = new Date("2026-04-24T12:00:00")
    date.setDate(date.getDate() + index)

    const weekday = date.getDay()
    const weekendMultiplier = weekday === 0 || weekday === 6 ? 0.35 : 1

    return {
      date: date.toISOString().slice(0, 10),

      collections: Math.round(
        (2800 +
          ((index * 431) % 9300) +
          Math.sin(index / 4) * 1850) *
          weekendMultiplier
      ),

      attendance: Math.round(
        Math.max(
          72,
          Math.min(
            99,
            88 + Math.sin(index / 5) * 5 + ((index * 7) % 6)
          )
        )
      ),

      assessments: Math.round(
        (12 + ((index * 19) % 44) + Math.cos(index / 3) * 7) *
          weekendMultiplier
      ),

      enrollment: Math.max(
        0,
        Math.round(
          (index % 11 === 0 ? 6 : index % 5 === 0 ? 3 : 1) *
            weekendMultiplier
        )
      ),
    }
  }
)

function MetricTrendCard({
  title,
  description,
  dataKey,
  footer,
}: {
  title: string
  description: string
  dataKey: keyof typeof chartConfig
  footer: string
}) {
  const total = chartData.reduce(
    (sum, row) => sum + Number(row[dataKey] ?? 0),
    0
  )

  const average =
    dataKey === "attendance"
      ? Math.round(total / chartData.length)
      : total.toLocaleString()

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="gap-1 px-5 pt-5 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {title}
        </CardDescription>

        <CardTitle className="text-2xl font-semibold tracking-tight">
          {dataKey === "attendance" ? `${average}%` : average}
        </CardTitle>

        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="px-3 pt-1 pb-2">
        <ChartContainer config={chartConfig} className="h-[105px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
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

export default function DashboardPage() {
  const [activeMetric, setActiveMetric] =
    React.useState<(typeof metrics)[number]["key"]>("collections")

  const totals = React.useMemo(() => {
    return {
      collections: chartData.reduce((sum, row) => sum + row.collections, 0),
      attendance: Math.round(
        chartData.reduce((sum, row) => sum + row.attendance, 0) /
          chartData.length
      ),
      assessments: chartData.reduce((sum, row) => sum + row.assessments, 0),
      enrollment: chartData.reduce((sum, row) => sum + row.enrollment, 0),
    }
  }, [])

  return (
    <div className="flex flex-col gap-5 p-2 md:p-1">
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="flex flex-col items-stretch gap-0 border-b p-0 lg:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-5 pb-4 lg:py-0">
            <CardTitle className="text-xl">School Operations Overview</CardTitle>

            <CardDescription>
              Activity across fees, attendance, academics, and student enrolment
              over the last 90 days.
            </CardDescription>
          </div>

          <div className="grid grid-cols-2 border-t sm:grid-cols-4 lg:border-t-0">
            {metrics.map((metric) => {
              const isActive = activeMetric === metric.key

              const displayValue =
                metric.key === "collections"
                  ? `GH₵${totals.collections.toLocaleString()}`
                  : metric.key === "attendance"
                    ? `${totals.attendance}%`
                    : totals[metric.key].toLocaleString()

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
                    className="text-xl font-bold tracking-tight lg:text-2xl"
                    style={{
                      color: isActive ? metric.color : "hsl(var(--foreground))",
                    }}
                  >
                    {displayValue}
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
              data={chartData}
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
                    className="w-[165px]"
                    labelFormatter={(value) =>
                      formatDate(String(value), {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
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
        <MetricTrendCard
          title="Average Attendance"
          description="Daily school-wide attendance performance"
          dataKey="attendance"
          footer="Stable attendance across the current term"
        />

        <MetricTrendCard
          title="Fee Collections"
          description="Daily payments received and posted"
          dataKey="collections"
          footer="Collections peak around fee deadlines"
        />

        <MetricTrendCard
          title="Assessment Activity"
          description="Recorded continuous-assessment entries"
          dataKey="assessments"
          footer="Academic activity across all sections"
        />

        <MetricTrendCard
          title="New Enrolment"
          description="Student admissions and transfers recorded"
          dataKey="enrollment"
          footer="Admissions movement over the last 90 days"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            School performance is trending positively
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardTitle>

          <CardDescription>
            This dashboard is currently using rich fictional presentation data
            while we finalize the analytics API shape.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}