"use client"

import * as React from "react"
import { Pie, PieChart, Label } from "recharts"

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
import type { EnrollmentDistributionData } from "@/lib/api/dashboard"

const fallbackStudentDistribution = [
  {
    type: "boarding",
    label: "Boarding",
    students: 467,
    fill: "var(--color-boarding)",
  },
  {
    type: "day",
    label: "Day Students",
    students: 760,
    fill: "var(--color-day)",
  },
]

const studentLevels = [
  {
    label: "Primary",
    count: 268,
    color: "#F4C430",
  },
  {
    label: "JHS",
    count: 438,
    color: "#7C3AED",
  },
  {
    label: "SHS",
    count: 521,
    color: "#FF5A36",
  },
]

const chartConfig = {
  students: {
    label: "Students",
  },
  assigned: {
    label: "Assigned",
    color: "#7C3AED",
  },
  unassigned: {
    label: "Unassigned",
    color: "#FF5A36",
  },
} satisfies ChartConfig

interface DashboardStudentsCardProps {
  enrollment?: EnrollmentDistributionData
}

export function DashboardStudentsCard({
  enrollment,
}: DashboardStudentsCardProps) {
  const studentDistribution = enrollment
    ? [
        {
          type: "assigned",
          label: "Assigned",
          students: enrollment.classes
            .filter((item) => item.classId !== null)
            .reduce((total, item) => total + item.students, 0),
          fill: "var(--color-assigned)",
        },
        {
          type: "unassigned",
          label: "Unassigned",
          students: enrollment.classes
            .filter((item) => item.classId === null)
            .reduce((total, item) => total + item.students, 0),
          fill: "var(--color-unassigned)",
        },
      ]
    : fallbackStudentDistribution

  const totalStudents = enrollment?.total ?? studentDistribution.reduce(
    (total, item) => total + item.students,
    0,
  )

  const newStudents = 34

  return (
    <Card className="flex h-full min-h-[430px] flex-col overflow-hidden rounded-[24px] border border-border/60 bg-card py-0 shadow-sm">

      {/* HEADER */}
      <CardHeader className="px-6 pb-0 pt-6 sm:px-7 sm:pt-7">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">

            <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Student population
            </CardDescription>

            <CardTitle className="mt-2 text-xl font-semibold tracking-[-0.02em]">
              Enrollment composition
            </CardTitle>

          </div>

          <div className="shrink-0 text-right">

            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">

              <span className="size-1.5 rounded-full bg-emerald-500" />

              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                +{newStudents} this term
              </span>

            </div>

          </div>

        </div>

      </CardHeader>

      {/* HERO DONUT */}
      <CardContent className="flex flex-1 flex-col px-4 pb-0 pt-1 sm:px-6">

        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[330px] flex-1 min-h-[285px]"
        >

          <PieChart>

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  indicator="dot"
                  formatter={(value, name) => {
                    const numericValue = Number(value)
                    const percentage =
                      (numericValue / totalStudents) * 100

                    return [
                      `${numericValue.toLocaleString()} students · ${percentage.toFixed(1)}%`,
                      name,
                    ]
                  }}
                />
              }
            />

            <Pie
              data={studentDistribution}
              dataKey="students"
              nameKey="label"
              innerRadius={92}
              outerRadius={132}
              paddingAngle={3}
              cornerRadius={7}
              strokeWidth={0}
            >

              <Label
                content={({ viewBox }) => {

                  if (
                    viewBox &&
                    "cx" in viewBox &&
                    "cy" in viewBox
                  ) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >

                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 7}
                          className="fill-foreground text-[34px] font-semibold tracking-[-0.045em]"
                        >
                          {totalStudents.toLocaleString()}
                        </tspan>

                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 18}
                          className="fill-muted-foreground text-[11px]"
                        >
                          active students
                        </tspan>

                      </text>
                    )
                  }

                  return null
                }}
              />

            </Pie>

          </PieChart>

        </ChartContainer>

        {/* DONUT LEGEND */}
        <div className="mx-auto flex items-center justify-center gap-6 pb-5">

          {studentDistribution.map((item) => {

            const percentage =
              (item.students / totalStudents) * 100

            return (
              <div
                key={item.type}
                className="flex items-center gap-2"
              >

                <span
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor:
                      item.type === "boarding"
                        ? "#7C3AED"
                        : "#FF5A36",
                  }}
                />

                <div className="flex items-baseline gap-1.5">

                  <span className="text-xs font-medium">
                    {item.label}
                  </span>

                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </span>

                </div>

              </div>
            )
          })}

        </div>

      </CardContent>

      {/* EDUCATION BREAKDOWN */}
      <CardFooter className="flex-col items-stretch gap-0 border-t border-border/50 bg-muted/20 px-6 py-4 sm:px-7">

        <div className="mb-3 flex items-center justify-between">

          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Education level
          </span>

          <span className="text-[10px] text-muted-foreground">
            {totalStudents.toLocaleString()} students
          </span>

        </div>

        <div className="grid grid-cols-3 gap-5">

          {studentLevels.map((level) => {

            const percentage =
              (level.count / totalStudents) * 100

            return (
              <div
                key={level.label}
                className="min-w-0"
              >

                <div className="flex items-center gap-1.5">

                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: level.color,
                    }}
                  />

                  <span className="truncate text-[10px] text-muted-foreground">
                    {level.label}
                  </span>

                </div>

                <div className="mt-1 flex items-baseline gap-1.5">

                  <span className="text-sm font-semibold tabular-nums">
                    {level.count}
                  </span>

                  <span className="text-[9px] text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </span>

                </div>

              </div>
            )
          })}

        </div>

      </CardFooter>

    </Card>
  )
}