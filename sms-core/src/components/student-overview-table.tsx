"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

type StudentOverviewRow = {
  id: string
  studentName: string
  gender: string
  class: string
  parentName: string
  parentContact: string
  gpa: string
  attendanceRate: string
  status: string
  feesStatus: "Paid" | "Partial" | "Unpaid"
  enrollmentDate: string
}

interface StudentOverviewTableProps {
  data?: any[]
}

export function StudentOverviewTable({ data: initialData }: StudentOverviewTableProps) {
  const [students, setStudents] = React.useState<any[]>(initialData || [])
  const [loading, setLoading] = React.useState<boolean>(!initialData)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (initialData) {
      setStudents(initialData)
      setLoading(false)
      setError(null)
      return
    }

    const fetchStudents = async () => {
      try {
        setLoading(true)
        const response = await fetch("http://localhost:5000/api/students")
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`)
        }
        const json = await response.json()
        
        if (json && json.success && Array.isArray(json.data)) {
          setStudents(json.data)
        } else {
          throw new Error("Invalid structure format returned from database endpoint")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [initialData])

  const normalizedData: StudentOverviewRow[] = students.map((student) => {
    const formattedDate = student.enrollmentDate 
      ? new Date(student.enrollmentDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : "—"

    let financialStatus: "Paid" | "Partial" | "Unpaid" = "Unpaid"
    if (student.feesStatus === "Paid") financialStatus = "Paid"
    else if (student.feesStatus === "Partial") financialStatus = "Partial"

    // FIXED: Dig into the nested demographics relation for raw gender
    const rawGender = student.demographics?.gender || student.gender
    let cleanGender = "—"
    if (rawGender === "MALE") cleanGender = "Male"
    else if (rawGender === "FEMALE") cleanGender = "Female"
    else if (rawGender) cleanGender = rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase()

    // FIXED: Dig into the nested placement relation for raw class and track
    const rawClass = student.placement?.classId || student.class
    const rawTrack = student.placement?.academicTrack || student.grade
    const assignedClass = (rawClass && rawClass !== "N/A") 
      ? `${rawTrack || ""} ${rawClass}`.trim() 
      : rawTrack || "Unassigned"

    return {
      id: student.studentId || "—",
      studentName: student.studentName || "Unknown Student",
      gender: cleanGender,
      class: assignedClass,
      // FIXED: Dig into the nested guardians array (raw Prisma returns an array)
      parentName: student.guardians?.[0]?.name || student.guardian?.name || "Not Specified",
      parentContact: student.guardians?.[0]?.phone || student.guardian?.phone || "—",
      gpa: student.currentGpa?.toFixed(2) || "0.00",
      attendanceRate: student.attendanceRate != null ? `${student.attendanceRate}%` : "—", 
      status: student.status || "ACTIVE",
      feesStatus: financialStatus,
      enrollmentDate: formattedDate,
    }
  })

  const columns: DataTableColumn<StudentOverviewRow>[] = [
    {
      key: "id",
      header: "Student ID",
      className: "w-[110px]",
      cellClassName: "font-mono text-xs text-muted-foreground tracking-wider",
    },
    {
      key: "studentName",
      header: "Student Name",
      className: "min-w-[150px]",
      cellClassName: "font-medium text-zinc-900 dark:text-zinc-100",
    },
    {
      key: "gender",
      header: "Gender",
      className: "w-[85px]",
      cell: (row) => {
        const isMale = row.gender === "Male"
        const isFemale = row.gender === "Female"
        
        return (
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tracking-tight ${
            isMale 
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400" 
              : isFemale 
              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
              : "bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          }`}>
            {row.gender}
          </span>
        )
      }
    },
    {
      key: "class",
      header: "Class",
      className: "w-[90px]",
      cellClassName: "text-zinc-600 dark:text-zinc-400 font-medium text-xs",
    },
    {
      key: "parentName",
      header: "Parent/Guardian",
      className: "min-w-[130px]",
      cellClassName: "text-zinc-700 dark:text-zinc-300 text-sm truncate",
    },
    {
      key: "parentContact",
      header: "Parent Contact",
      className: "w-[120px]",
      cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400 tracking-tight",
    },
    {
      key: "gpa",
      header: "GPA",
      className: "w-[65px]",
      cellClassName: "font-mono font-medium text-zinc-900 dark:text-zinc-100",
    },
    {
      key: "attendanceRate",
      header: "Attendance",
      className: "w-[95px]",
      cellClassName: "font-mono text-zinc-600 dark:text-zinc-400",
    },
    {
      key: "enrollmentDate",
      header: "Enrollment",
      className: "w-[115px]",
      cellClassName: "text-zinc-500 dark:text-zinc-400 text-xs",
    },
    {
      key: "status",
      header: "Status",
      className: "w-[85px]",
      cell: (row) => {
        const isActive = row.status.toLowerCase() === "active"
        return (
          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
            isActive 
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" 
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}>
            {row.status}
          </span>
        )
      }
    },
    {
      key: "feesStatus",
      header: "Fees Status",
      className: "w-[105px]",
      cell: (row) => {
        const colorMap = {
          Paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
          Partial: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
          Unpaid: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30",
        }

        return (
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${colorMap[row.feesStatus]}`}>
            {row.feesStatus}
          </span>
        )
      }
    },
  ]

  if (loading) {
    return (
      <div className="flex h-48 w-full items-center justify-center text-sm text-zinc-500 animate-pulse">
        Loading real-time student overview records...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
        <p className="font-semibold">Backend Connection Failed</p>
        <p className="text-xs font-mono">{error}</p>
      </div>
    )
  }

  return (
    <UniversalDataTable
      data={normalizedData}
      columns={columns}
      rowId={(student) => student.id}
      emptyMessage="No student overview records found."
    />
  )
}