"use client"

import * as React from "react"
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  UserCheck,
  UserMinus,
  UserX,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

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
import type { AttendanceByClassData } from "@/lib/api/dashboard"

const attendanceData = [
  { day: "Mon", attendance: 94 },
  { day: "Tue", attendance: 91 },
  { day: "Wed", attendance: 96 },
  { day: "Thu", attendance: 93 },
  { day: "Fri", attendance: 95 },
  { day: "Mon", attendance: 92 },
  { day: "Tue", attendance: 94 },
  { day: "Wed", attendance: 97 },
  { day: "Thu", attendance: 95 },
  { day: "Fri", attendance: 96 },
  { day: "Mon", attendance: 93 },
  { day: "Tue", attendance: 95 },
  { day: "Wed", attendance: 96 },
  { day: "Thu", attendance: 94 },
]

const fallbackAttendance = {
  today: 94.8,
  yesterday: 93.1,

  present: 1163,
  late: 28,
  absent: 24,
  excused: 12,

  totalStudents: 1227,

  highestClass: {
    name: "JHS 2A",
    rate: 98.4,
  },

  lowestClass: {
    name: "SHS 1 Arts",
    rate: 89.7,
  },
}

const chartConfig = {
  attendance: {
    label: "Attendance",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

interface DashboardAttendanceCardProps {
  attendance?: AttendanceByClassData
}

export function DashboardAttendanceCard({
  attendance: liveAttendance,
}: DashboardAttendanceCardProps) {
  const liveClasses = liveAttendance?.classes ?? []

  const livePresent = liveClasses.reduce(
    (total, item) => total + item.present,
    0,
  )

  const liveTotal = liveClasses.reduce(
    (total, item) => total + item.total,
    0,
  )

  const liveToday =
    liveTotal > 0
      ? Number(((livePresent / liveTotal) * 100).toFixed(1))
      : 0

  const sortedClasses = [...liveClasses].sort(
    (a, b) => b.ratePct - a.ratePct,
  )

  const attendance = attendanceData
    ? {
        today: liveToday,
        yesterday: liveToday,
        present: livePresent,
        late: 0,
        absent: Math.max(liveTotal - livePresent, 0),
        excused: liveAttendance.skippedUnassigned,
        totalStudents: liveTotal,
        highestClass: {
          name: sortedClasses[0]?.className ?? "No class data",
          rate: sortedClasses[0]?.ratePct ?? 0,
        },
        lowestClass: {
          name:
            sortedClasses[sortedClasses.length - 1]?.className ??
            "No class data",
          rate: sortedClasses[sortedClasses.length - 1]?.ratePct ?? 0,
        },
      }
    : fallbackAttendance

  const change = attendance.today - attendance.yesterday

  return (
    <Card className="flex h-full min-h-[430px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card py-0 shadow-sm">

      {/* Header */}

      <CardHeader className="px-6 pt-6 pb-5 sm:px-7 sm:pt-7">

        <div className="flex items-start justify-between">

          <div className="space-y-1">

            <CardDescription className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-4 text-[#00A896]" />
              Attendance
            </CardDescription>

            <CardTitle className="text-xl font-semibold tracking-tight">
              Today's attendance
            </CardTitle>

          </div>

          <div className="text-right">

            <div className="flex items-baseline justify-end gap-1">

              <span className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
                {attendance.today}
              </span>

              <span className="text-lg font-medium text-muted-foreground">
                %
              </span>

            </div>

            <div className="mt-1.5 flex items-center justify-end gap-1 text-sm">

              <ArrowUpRight className="size-3.5 text-emerald-600" />

              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                +{change.toFixed(1)}%
              </span>

              <span className="text-muted-foreground">
                yesterday
              </span>

            </div>

          </div>

        </div>

      </CardHeader>

      {/* Main chart */}

      <CardContent className="px-3 sm:px-5">

        <div className="border-y border-border/60 py-4">

          <div className="mb-2 flex items-center justify-between px-2">

            <span className="text-sm font-medium">
              Last 14 school days
            </span>

            <span className="text-sm text-muted-foreground">
              School-wide
            </span>

          </div>

          <ChartContainer
            config={chartConfig}
            className="h-[190px] w-full"
          >

            <AreaChart
              data={attendanceData}
              margin={{
                left: 8,
                right: 8,
                top: 12,
                bottom: 0,
              }}
            >

              <defs>

                <linearGradient
                  id="attendanceArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >

                  <stop
                    offset="0%"
                    stopColor="var(--color-attendance)"
                    stopOpacity={0.18}
                  />

                  <stop
                    offset="100%"
                    stopColor="var(--color-attendance)"
                    stopOpacity={0}
                  />

                </linearGradient>

              </defs>

              <CartesianGrid
                vertical={false}
                strokeDasharray="4 4"
                opacity={0.2}
              />

              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
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
                      `${value}%`,
                      "Attendance",
                    ]}
                  />
                }
              />

              <Area
                dataKey="attendance"
                type="natural"
                stroke="var(--color-attendance)"
                strokeWidth={2.5}
                fill="url(#attendanceArea)"
              />

            </AreaChart>

          </ChartContainer>

        </div>

      </CardContent>

      {/* Attendance breakdown */}

      <CardContent className="px-6 pt-5 sm:px-7">

        <div className="grid grid-cols-4">

          <AttendanceMetric
            icon={UserCheck}
            label="Present"
            value={attendance.present}
            iconClass="text-[#00A896]"
          />

          <AttendanceMetric
            icon={Clock3}
            label="Late"
            value={attendance.late}
            iconClass="text-[#D99A00]"
          />

          <AttendanceMetric
            icon={UserX}
            label="Absent"
            value={attendance.absent}
            iconClass="text-[#FF5A36]"
          />

          <AttendanceMetric
            icon={UserMinus}
            label="Excused"
            value={attendance.excused}
            iconClass="text-[#7C3AED]"
          />

        </div>

      </CardContent>

      {/* Class comparison */}

      <CardContent className="mt-auto px-6 pt-5 pb-6 sm:px-7">

        <div className="flex items-center justify-between border-t border-border/60 pt-4">

          <div>

            <p className="text-sm text-muted-foreground">
              Highest class
            </p>

            <div className="mt-1 flex items-center gap-2">

              <span className="font-semibold">
                {attendance.highestClass.name}
              </span>

              <span className="text-sm font-medium text-[#00A896]">
                {attendance.highestClass.rate}%
              </span>

            </div>

          </div>

          <div className="h-8 w-px bg-border/60" />

          <div className="text-right">

            <p className="text-sm text-muted-foreground">
              Lowest class
            </p>

            <div className="mt-1 flex items-center justify-end gap-2">

              <span className="font-semibold">
                {attendance.lowestClass.name}
              </span>

              <span className="text-sm font-medium text-[#FF5A36]">
                {attendance.lowestClass.rate}%
              </span>

            </div>

          </div>

        </div>

      </CardContent>

    </Card>
  )
}

function AttendanceMetric({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ElementType
  label: string
  value: number
  iconClass: string
}) {
  return (
    <div className="border-r border-border/60 px-3 first:pl-0 last:border-r-0 last:pr-0">

      <div className="flex items-center gap-1.5">

        <Icon className={`size-4 ${iconClass}`} />

        <span className="text-sm text-muted-foreground">
          {label}
        </span>

      </div>

      <p className="mt-2 text-lg font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>

    </div>
  )
}