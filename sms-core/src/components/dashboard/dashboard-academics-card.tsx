"use client"

import * as React from "react"
import {
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Trophy,
} from "lucide-react"
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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { AcademicPerformanceData } from "@/lib/api/dashboard"

const gpaDistribution = [
  { range: "0–1", students: 42 },
  { range: "1–2", students: 116 },
  { range: "2–3", students: 384 },
  { range: "3–4", students: 685 },
]

const academics = {
  totalStudents: 1227,
  cumulativeGpa: 3.24,
  previousGpa: 3.11,
  passRate: 86.7,

  strongestClass: {
    name: "SHS 2 Science",
    average: 87,
  },

  attentionClass: {
    name: "SHS 1 Arts",
    average: 68,
  },

  caRecords: 11842,
  examRecords: 7346,
}

const chartConfig = {
  students: {
    label: "Students",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

interface DashboardAcademicsCardProps {
  performance?: AcademicPerformanceData
}

export function DashboardAcademicsCard({
  performance,
}: DashboardAcademicsCardProps) {
  const liveClassAverages = [...(performance?.perClass ?? [])].sort(
    (a, b) => b.averageScore - a.averageScore,
  )

  const liveStrongestClass = liveClassAverages[0]
  const liveAttentionClass =
    liveClassAverages[liveClassAverages.length - 1]

  const liveGpaDistribution =
    performance?.gpaDistribution.map((item) => ({
      range: item.bucket.replace("-", "–"),
      students: item.students,
    })) ?? gpaDistribution

  const academicsView = performance
    ? {
        totalStudents: performance.activeStudents,
        cumulativeGpa: performance.schoolAverageGpa,
        previousGpa: performance.schoolAverageGpa,
        passRate:
          performance.perSubject.length > 0
            ? performance.perSubject.reduce(
                (total, subject) => total + subject.passRatePct,
                0,
              ) / performance.perSubject.length
            : 0,
        strongestClass: {
          name: liveStrongestClass?.className ?? "No class data",
          average: liveStrongestClass?.averageScore ?? 0,
        },
        attentionClass: {
          name: liveAttentionClass?.className ?? "No class data",
          average: liveAttentionClass?.averageScore ?? 0,
        },
        caRecords: performance.perSubject.reduce(
          (total, subject) => total + subject.records,
          0,
        ),
        examRecords: 0,
      }
    : academics

  const gpaChange =
    academicsView.cumulativeGpa - academicsView.previousGpa

  return (
    <Card className="flex h-full min-h-[390px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card py-0 shadow-sm">

      {/* Header */}
      <CardHeader className="px-6 pt-6 pb-4">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">

            <CardDescription className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <BookOpen className="size-4 text-[#7C3AED]" />
              Academics
            </CardDescription>

            <CardTitle className="mt-1.5 text-lg font-semibold tracking-tight">
              Academic performance
            </CardTitle>

          </div>

          <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="size-3.5" />
            +{gpaChange.toFixed(2)} GPA
          </div>

        </div>

        {/* Primary metrics */}
        <div className="mt-5 flex items-end justify-between">

          <div>

            <p className="text-xs text-muted-foreground">
              Cumulative GPA
            </p>

            <div className="mt-1 flex items-baseline gap-1.5">

              <span className="text-[2.7rem] font-semibold leading-none tracking-[-0.06em] tabular-nums">
                {academicsView.cumulativeGpa.toFixed(2)}
              </span>

              <span className="text-xs text-muted-foreground">
                / 4.00
              </span>

            </div>

          </div>

          <div className="text-right">

            <p className="text-xs text-muted-foreground">
              School pass rate
            </p>

            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[#00A896]">
              {academicsView.passRate}%
            </p>

          </div>

        </div>

      </CardHeader>


      {/* GPA Distribution */}
      <CardContent className="px-4 sm:px-5">

        <div className="border-y border-border/60 py-4">

          <div className="mb-2 flex items-center justify-between px-1">

            <span className="text-xs font-medium">
              GPA distribution
            </span>

            <span className="text-[11px] text-muted-foreground">
              {academicsView.totalStudents.toLocaleString()} students
            </span>

          </div>

          <ChartContainer
            config={chartConfig}
            className="h-[155px] w-full"
          >

            <BarChart
              data={liveGpaDistribution}
              barCategoryGap="0%"
              barGap={0}
              margin={{
                left: 0,
                right: 0,
                top: 12,
                bottom: 0,
              }}
            >

              <CartesianGrid
                vertical={false}
                strokeDasharray="4 4"
                opacity={0.16}
              />

              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />

              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value) => [
                      `${Number(value).toLocaleString()} students`,
                      "Students",
                    ]}
                  />
                }
              />

              <Bar
                dataKey="students"
                fill="var(--color-students)"
                radius={[5, 5, 1, 1]}
              />

            </BarChart>

          </ChartContainer>

        </div>

      </CardContent>


      {/* Bottom insights */}
      <CardContent className="mt-auto px-6 pt-4 pb-5">

        <div className="grid grid-cols-3 divide-x divide-border/60">

          {/* Top class */}
          <div className="min-w-0 pr-4">

            <div className="flex items-center gap-1.5">

              <Trophy className="size-3.5 shrink-0 text-[#F4C430]" />

              <span className="text-xs text-muted-foreground">
                Top class
              </span>

            </div>

            <p className="mt-1 truncate text-sm font-semibold">
              {academicsView.strongestClass.name}
            </p>

            <p className="mt-0.5 text-xs font-medium text-[#00A896]">
              {academicsView.strongestClass.average}% average
            </p>

          </div>


          {/* Attention */}
          <div className="min-w-0 px-4">

            <p className="text-xs text-muted-foreground">
              Needs attention
            </p>

            <p className="mt-1 truncate text-sm font-semibold">
              {academicsView.attentionClass.name}
            </p>

            <p className="mt-0.5 text-xs font-medium text-[#FF5A36]">
              {academicsView.attentionClass.average}% average
            </p>

          </div>


          {/* Records */}
          <div className="min-w-0 pl-4">

            <div className="flex items-center gap-1.5">

              <ClipboardCheck className="size-3.5 shrink-0 text-[#7C3AED]" />

              <span className="text-xs text-muted-foreground">
                Records
              </span>

            </div>

            <p className="mt-1 text-sm font-semibold tabular-nums">
              {(
                academicsView.caRecords +
                academicsView.examRecords
              ).toLocaleString()}
            </p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              CA + exams
            </p>

          </div>

        </div>

      </CardContent>

    </Card>
  )
}