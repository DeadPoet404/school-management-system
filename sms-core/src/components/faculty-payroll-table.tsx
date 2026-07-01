"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

export type FacultyPayrollRow = {
  id: string
  name: React.ReactNode
  baseSalary: string
  deductions: string
  netPay: string
  accountRouting: React.ReactNode
  payoutStatus: React.ReactNode
}

interface FacultyPayrollTableProps {
  data: any[]
}

export function FacultyPayrollTable({ data: rawTeachers }: FacultyPayrollTableProps) {
  const transformedData = React.useMemo(() => {
    const payStatusColors: Record<string, string> = {
      PAID: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded text-xs font-semibold tracking-wider font-mono",
      PENDING: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded text-xs font-semibold tracking-wider font-mono",
    }

    return rawTeachers.map((item, index) => {
      const fallbackId = item.teacherId || item.id || `TCH-${index}`
      
      const base = item.baseSalary || item.payroll?.baseSalary ? parseFloat(item.baseSalary || item.payroll?.baseSalary) : 0
      const deduct = item.totalDeductions || 0
      const net = item.netPay || (base - deduct)
      const currentPayStatus = item.payroll?.salaryStatus || "PENDING"

      const bankLabel = item.payroll?.bankName || "Ghana Commercial Bank"
      const accountNo = item.payroll?.bankAccount || "—"

      return {
        id: fallbackId,
        name: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight block whitespace-nowrap">
            {item.account?.fullName || item.teacherName || "Unknown Faculty"}
          </span>
        ),
        baseSalary: base > 0 ? `GH₵ ${base.toFixed(2)}` : "—",
        deductions: deduct > 0 ? `GH₵ ${deduct.toFixed(2)}` : "—",
        netPay: net > 0 ? `GH₵ ${net.toFixed(2)}` : "—",
        accountRouting: (
          <div className="flex flex-col text-left whitespace-nowrap">
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{bankLabel}</span>
            <span className="font-mono text-[11px] text-muted-foreground tracking-tight select-all">{accountNo}</span>
          </div>
        ),
        payoutStatus: (
          <span className={payStatusColors[currentPayStatus] || "text-zinc-400 text-xs font-mono whitespace-nowrap"}>
            {currentPayStatus}
          </span>
        ),
      }
    })
  }, [rawTeachers])

  const columns = React.useMemo<DataTableColumn<FacultyPayrollRow>[]>(() => [
    { key: "id", header: "Teacher ID", className: "w-[120px]", cellClassName: "font-mono text-xs text-muted-foreground tracking-wider font-semibold whitespace-nowrap" },
    { key: "name", header: "Faculty Name", className: "w-[150px]" },
    { key: "baseSalary", header: "Base Salary", className: "w-[120px]", cellClassName: "font-mono text-xs text-zinc-700 dark:text-zinc-300 text-right pr-2 whitespace-nowrap" },
    { key: "deductions", header: "Deductions", className: "w-[110px]", cellClassName: "font-mono text-xs text-red-600 dark:text-red-400 text-right pr-2 whitespace-nowrap" },
    { key: "netPay", header: "Net Payout", className: "w-[120px]", cellClassName: "font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-right pr-2 whitespace-nowrap" },
    { key: "accountRouting", header: "Disbursement Route", className: "w-[240px]" },
    { key: "payoutStatus", header: "Payout State", className: "w-[110px]" },
  ], [])

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No compensation schedules map to active faculty members."
    />
  )
}