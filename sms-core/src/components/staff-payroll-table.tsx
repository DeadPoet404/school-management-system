"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

export type StaffPayrollRow = {
  id: string
  name: React.ReactNode
  clearanceTier: string
  baseSalary: string
  bankRouting: React.ReactNode
  payrollStatus: React.ReactNode
}

interface StaffPayrollTableProps {
  data: any[]
}

export function StaffPayrollTable({ data: rawStaff }: StaffPayrollTableProps) {
  const transformedData = React.useMemo(() => {
    const payrollStatusColors: Record<string, string> = {
      PAID: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded text-xs font-semibold tracking-wider font-mono",
      PENDING: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded text-xs font-semibold tracking-wider font-mono",
      PROCESSING: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded text-xs font-semibold tracking-wider font-mono",
    }

    return rawStaff.map((item, index) => {
      const fallbackId = item.staffId || item.id || `STF-${index}`
      const salaryAmount = item.payroll?.baseSalary ? parseFloat(item.payroll.baseSalary) : 0
      const currentPayStatus = item.payroll?.salaryStatus || "PENDING"

      const bankLabel = item.payroll?.bankName || "—"
      const accountNo = item.payroll?.bankAccount || "Unconfigured"

      return {
        id: fallbackId,
        name: (
          <span className="text-zinc-900 dark:text-zinc-100 font-medium tracking-tight block max-w-[120px] truncate">
            {item.staffName || "Unknown Employee"}
          </span>
        ),
        clearanceTier: item.payroll?.clearanceTier || "TIER-1",
        baseSalary: salaryAmount > 0 ? `GH₵ ${salaryAmount.toFixed(2)}` : "—",
        bankRouting: (
          <div className="flex flex-col text-left max-w-[240px]">
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{bankLabel}</span>
            <span className="font-mono text-[11px] text-muted-foreground tracking-tight truncate select-all">{accountNo}</span>
          </div>
        ),
        payrollStatus: (
          <span className={payrollStatusColors[currentPayStatus] || "text-zinc-400 text-xs font-mono"}>
            {currentPayStatus}
          </span>
        ),
      }
    })
  }, [rawStaff])

  const columns = React.useMemo<DataTableColumn<StaffPayrollRow>[]>(() => [
    { key: "id", header: "Staff ID", className: "w-[120px]", cellClassName: "font-mono text-xs text-muted-foreground tracking-wider font-semibold" },
    { key: "name", header: "Employee Name", className: "w-[140px]" },
    { key: "clearanceTier", header: "Clearance Level", className: "w-[130px]", cellClassName: "font-mono text-xs text-zinc-500 tracking-tight" },
    { key: "baseSalary", header: "Base Salary", className: "w-[130px]", cellClassName: "font-mono text-xs text-zinc-800 dark:text-zinc-200 text-right pr-4" },
    { key: "bankRouting", header: "Disbursement Bank / Account", className: "w-[250px] max-w-[250px]" },
    { key: "payrollStatus", header: "Payout State", className: "w-[110px]" },
  ], [])

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No financial ledger profiles match current payroll cycles."
    />
  )
}