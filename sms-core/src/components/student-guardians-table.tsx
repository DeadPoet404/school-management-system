"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

type StudentRow = {
  id: string
  studentName: string
  guardianName?: string
  guardianPhone: string
}

interface StudentGuardiansTableProps {
  data: StudentRow[]
}

export function StudentGuardiansTable({ data }: StudentGuardiansTableProps) {
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
      className: "min-w-[180px]",
      cellClassName: "font-medium text-zinc-900 dark:text-zinc-100",
    },
    {
      key: "guardianName",
      header: "Primary Guardian",
      className: "min-w-[180px]",
      cellClassName: "font-medium text-zinc-900 dark:text-zinc-100",
      cell: (row) => row.guardianName || "—"
    },
    {
      key: "guardianPhone",
      header: "Guardian Phone Contact",
      className: "min-w-[160px]",
      cellClassName: "font-mono text-sm text-zinc-600 dark:text-zinc-400",
    },
  ]

  return (
    <UniversalDataTable
      data={data}
      columns={columns}
      rowId={(student) => student.id}
      emptyMessage="No guardian relative links found."
    />
  )
}