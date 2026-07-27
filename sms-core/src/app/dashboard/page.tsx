"use client"

import * as React from "react"
import { AlertCircle, Loader2, TrendingUp } from "lucide-react"
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

import { fetchWithAuth } from "@/lib/fetch-with-auth"

type DashboardChartPoint = {
  date: string
  collections: number
  attendance: number
  assessments: number
  enrollment: number
}

type DashboardAnalytics = {
  generatedAt: string
  range: {
    startDate: string
    endDate: string
    days: number
  }
  totals: {
    collections: number
    attendance: number
    assessments: number
    enrollment: number
    totalStudents: number
    activeStudents: number
    totalTeachers: number
    totalStaff: number
    invoiced: number
    invoicePayments: number
    outstanding: number
    openInvoices: number
    collectionTransactions: number
    invoices: number
  }
  chartData: DashboardChartPoint[]
}

type DashboardResponse = {
  success?: boolean
  message?: string
  data?: DashboardAnalytics
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

function formatMetricValue(
  key: keyof typeof chartConfig,
  value: number
) {
  if (key === "collections") {
    return `GH₵${Math.round(value).toLocaleString()}`
  }

  if (key === "attendance") {
    return `${Math.round(value)}%`
  }

  return Math.round(value).toLocaleString()
}

function MetricTrendCard({
  title,
  description,
  dataKey,
  footer,
  chartData,
}: {
  title: string
  description: string
  dataKey: keyof typeof chartConfig
  footer: string
  chartData: DashboardChartPoint[]
}) {
  const total = chartData.reduce(
    (sum, row) => sum + Number(row[dataKey] ?? 0),
    0
  )

  const displayValue =
    dataKey === "attendance"
      ? `${chartData.length > 0 ? Math.round(total / chartData.length) : 0}%`
      : dataKey === "collections"
        ? `GH₵${Math.round(total).toLocaleString()}`
        : total.toLocaleString()

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="gap-1 px-5 pt-5 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {title}
        </CardDescription>

        <CardTitle className="text-2xl font-semibold tracking-tight">
          {displayValue}
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
  const [dashboard, setDashboard] = React.useState<DashboardAnalytics | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetchWithAuth("/analytics/dashboard?days=90")
        const json = (await response.json()) as DashboardResponse

        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.message || `Unable to load dashboard analytics. HTTP ${response.status}`)
        }

        if (!cancelled) {
          setDashboard(json.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load dashboard analytics.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading && !dashboard) {
    return (
      <div className="flex flex-col gap-5 p-2 md:p-1">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading dashboard analytics
            </CardTitle>
            <CardDescription>
              Fetching live school operations data from the backend.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="flex flex-col gap-5 p-2 md:p-1">
        <Card className="border-destructive/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="h-4 w-4" />
              Dashboard analytics unavailable
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const chartData = dashboard?.chartData ?? []
  const totals = dashboard?.totals ?? {
    collections: 0,
    attendance: 0,
    assessments: 0,
    enrollment: 0,
    totalStudents: 0,
    activeStudents: 0,
    totalTeachers: 0,
    totalStaff: 0,
    invoiced: 0,
    invoicePayments: 0,
    outstanding: 0,
    openInvoices: 0,
    collectionTransactions: 0,
    invoices: 0,
  }

  return (
    <div className="flex flex-col gap-5 p-2 md:p-1">
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="flex flex-col items-stretch gap-0 border-b p-0 lg:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-5 pb-4 lg:py-0">
            <CardTitle className="text-xl">School Operations Overview</CardTitle>

            <CardDescription>
              Live activity across fees, attendance, academics, and student enrolment
              over the last {dashboard?.range.days ?? 90} days.
            </CardDescription>
          </div>

          <div className="grid grid-cols-2 border-t sm:grid-cols-4 lg:border-t-0">
            {metrics.map((metric) => {
              const isActive = activeMetric === metric.key
              const displayValue = formatMetricValue(metric.key, totals[metric.key])

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
          footer={`${totals.activeStudents.toLocaleString()} active students in the current database`}
          chartData={chartData}
        />

        <MetricTrendCard
          title="Fee Collections"
          description="Daily payments received and posted"
          dataKey="collections"
          footer={`${totals.collectionTransactions.toLocaleString()} payment transactions recorded`}
          chartData={chartData}
        />

        <MetricTrendCard
          title="Assessment Activity"
          description="Recorded continuous-assessment entries"
          dataKey="assessments"
          footer={`${totals.assessments.toLocaleString()} grade records in the selected range`}
          chartData={chartData}
        />

        <MetricTrendCard
          title="New Enrolment"
          description="Student admissions and transfers recorded"
          dataKey="enrollment"
          footer={`${totals.totalStudents.toLocaleString()} total students in the system`}
          chartData={chartData}
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Live analytics are connected
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardTitle>

          <CardDescription>
            Dashboard values now come from /api/analytics/dashboard using students,
            attendance records, grade records, invoices, and payment collections.
            Outstanding invoices: GH₵{Math.round(totals.outstanding).toLocaleString()}.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
