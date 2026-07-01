"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

type StudentRow = {
  id: string
  studentName: string
  class: string
  currentGpa: number
  overallAverage: number
  creditsEarned: number
  failedCourses: number
  attendanceRate: number
  classRank: number
  academicStanding: string
}

const dummyStudents: StudentRow[] = [
  {
    id: "STU-001",
    studentName: "Amara Diallo",
    class: "12A",
    currentGpa: 3.85,
    overallAverage: 92,
    creditsEarned: 112,
    failedCourses: 0,
    attendanceRate: 96,
    classRank: 3,
    academicStanding: "Good Standing",
  },
  {
    id: "STU-002",
    studentName: "Liam Sterling",
    class: "12B",
    currentGpa: 2.91,
    overallAverage: 78,
    creditsEarned: 78,
    failedCourses: 0,
    attendanceRate: 88,
    classRank: 18,
    academicStanding: "Good Standing",
  },
  {
    id: "STU-003",
    studentName: "Chloe Zhang",
    class: "11A",
    currentGpa: 3.97,
    overallAverage: 95,
    creditsEarned: 45,
    failedCourses: 0,
    attendanceRate: 99,
    classRank: 1,
    academicStanding: "Good Standing",
  },
  {
    id: "STU-004",
    studentName: "Marcus Vance",
    class: "12A",
    currentGpa: 2.15,
    overallAverage: 58,
    creditsEarned: 96,
    failedCourses: 2,
    attendanceRate: 74,
    classRank: 45,
    academicStanding: "Probation",
  },
  {
    id: "STU-005",
    studentName: "Elena Rostova",
    class: "11B",
    currentGpa: 3.64,
    overallAverage: 86,
    creditsEarned: 82,
    failedCourses: 0,
    attendanceRate: 92,
    classRank: 8,
    academicStanding: "Good Standing",
  },
  {
    id: "STU-006",
    studentName: "Devon Lane",
    class: "10A",
    currentGpa: 3.42,
    overallAverage: 81,
    creditsEarned: 16,
    failedCourses: 0,
    attendanceRate: 95,
    classRank: 12,
    academicStanding: "Good Standing",
  },
  {
    id: "STU-007",
    studentName: "Jane Cooper",
    class: "12A",
    currentGpa: 3.80,
    overallAverage: 90,
    creditsEarned: 120,
    failedCourses: 0,
    attendanceRate: 100,
    classRank: 5,
    academicStanding: "Good Standing",
  },
  {
    id: "STU-008",
    studentName: "Omar Sy",
    class: "11A",
    currentGpa: 1.90,
    overallAverage: 52,
    creditsEarned: 52,
    failedCourses: 3,
    attendanceRate: 81,
    classRank: 39,
    academicStanding: "Probation",
  },
]

export function StudentAcademicsTable() {
  const greenBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60"
  const redBadgeClass = "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"

  const columns: DataTableColumn<StudentRow>[] = [
    {
      key: "id",
      header: "Student ID",
      className: "w-[120px]",
      cellClassName: "font-mono text-xs text-muted-foreground",
    },
    {
      key: "studentName",
      header: "Student Name",
      className: "min-w-[160px]",
      cellClassName: "font-medium text-zinc-900 dark:text-zinc-100",
    },
    {
      key: "class",
      header: "Class",
      className: "w-[80px]",
      cellClassName: "font-medium text-zinc-500",
    },
    {
      key: "currentGpa",
      header: "Current GPA",
      className: "w-[110px]",
      cell: (row) => {
        const isGoodGpa = row.currentGpa >= 2.5
        return (
          <Badge 
            variant="outline" 
            className={`font-mono font-medium shadow-none ${isGoodGpa ? greenBadgeClass : redBadgeClass}`}
          >
            {row.currentGpa.toFixed(2)}
          </Badge>
        )
      },
    },
    {
      key: "overallAverage",
      header: "Overall Average",
      className: "w-[130px]",
      cell: (row) => {
        const isGoodAverage = row.overallAverage >= 60
        return (
          <Badge 
            variant="outline" 
            className={`font-mono font-medium shadow-none ${isGoodAverage ? greenBadgeClass : redBadgeClass}`}
          >
            {row.overallAverage}%
          </Badge>
        )
      },
    },
    {
      key: "creditsEarned",
      header: "Credits Earned",
      className: "w-[120px]",
      cellClassName: "font-mono text-sm text-zinc-600 dark:text-zinc-400",
    },
    {
      key: "failedCourses",
      header: "Failed Courses",
      className: "w-[120px]",
      cell: (row) => {
        const hasNoFailures = row.failedCourses === 0
        return (
          <Badge 
            variant="outline" 
            className={`font-mono font-medium shadow-none ${hasNoFailures ? greenBadgeClass : redBadgeClass}`}
          >
            {row.failedCourses}
          </Badge>
        )
      },
    },
    {
      key: "attendanceRate",
      header: "Attendance",
      className: "w-[110px]",
      cell: (row) => {
        const isGoodAttendance = row.attendanceRate >= 90
        return (
          <Badge 
            variant="outline" 
            className={`font-mono font-medium shadow-none ${isGoodAttendance ? greenBadgeClass : redBadgeClass}`}
          >
            {row.attendanceRate}%
          </Badge>
        )
      },
    },
    {
      key: "classRank",
      header: "Class Rank",
      className: "w-[100px]",
      cellClassName: "font-mono font-medium text-zinc-900 dark:text-zinc-100",
    },
    {
      key: "academicStanding",
      header: "Academic Standing",
      className: "w-[150px]",
      cell: (row) => {
        const isGoodStanding = row.academicStanding === "Good Standing"
        return (
          <Badge 
            variant="outline" 
            className={`font-medium shadow-none ${isGoodStanding ? greenBadgeClass : redBadgeClass}`}
          >
            {row.academicStanding}
          </Badge>
        )
      },
    },
  ]

  return (
    <UniversalDataTable
      data={dummyStudents}
      columns={columns}
      rowId={(student) => student.id}
      emptyMessage="No academic records found."
    />
  )
}