"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"
import { fetchWithAuth } from "@/lib/fetch-with-auth";

type StudentFeeInfoRow = {
  id: string
  studentName: string
  lastTransactionDate: string
  transactionId: string
  paymentType: string
  lastPaymentAmount: string
  totalFeesPaid: string
  totalFeesLeft: string
  rawBalance: number
}

interface StudentFeeInfoTableProps {
  data?: any[]
}

export function StudentFeeInfoTable({ data: initialData }: StudentFeeInfoTableProps) {
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
        const response = await fetchWithAuth("/students")
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`)
        }
        const json = await response.json()
        
        if (json.success && Array.isArray(json.data)) {
          setStudents(json.data)
        } else if (Array.isArray(json)) {
          setStudents(json)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const normalizedData = students.map((student): StudentFeeInfoRow => {
    const name = student.studentName || "Unknown Student"
    
    const formattedTxDate = student.lastTransactionDate || student.lastPaymentDate
      ? new Date(student.lastTransactionDate || student.lastPaymentDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : "—"

    const lastPaidNum = Number(student.lastPaymentAmount || student.lastAmount || 0)
    const totalPaidNum = Number(student.totalFeesPaid || student.totalPaid || 0)
    const balanceLeftNum = Number(student.totalFeesLeft || student.balance || 0)

    let displayPaymentType = student.paymentType || student.paymentMethod || "—"
    if (displayPaymentType.toLowerCase() === "momo" || displayPaymentType.toLowerCase() === "mobile money") {
      displayPaymentType = "Mobile Money"
    } else if (displayPaymentType !== "—") {
      displayPaymentType = displayPaymentType.charAt(0).toUpperCase() + displayPaymentType.slice(1)
    }

    return {
      id: student.studentId || "—",
      studentName: name,
      lastTransactionDate: formattedTxDate,
      transactionId: student.transactionId || student.lastTxId || "—",
      paymentType: displayPaymentType,
      lastPaymentAmount: formatCurrency(lastPaidNum),
      totalFeesPaid: formatCurrency(totalPaidNum),
      totalFeesLeft: formatCurrency(balanceLeftNum),
      rawBalance: balanceLeftNum,
    }
  })

  // Columns tuned for high symmetry and clean width distributions
  const columns: DataTableColumn<StudentFeeInfoRow>[] = [
    {
      key: "id",
      header: "Student ID",
      className: "w-[100px]",
      cellClassName: "font-mono text-xs text-muted-foreground tracking-wider",
    },
    {
      key: "studentName",
      header: "Student Name",
      className: "w-[130px]",
      cellClassName: "font-medium text-zinc-900 dark:text-zinc-100 text-xs truncate max-w-[130px]",
    },
    {
      key: "lastTransactionDate",
      header: "Last Tx Date",
      className: "w-[110px]",
      cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400",
    },
    {
      key: "transactionId",
      header: "Transaction ID",
      className: "w-[120px]",
      cellClassName: "font-mono text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[120px] tracking-tight",
    },
    {
      key: "paymentType",
      header: "Payment Type",
      className: "w-[110px]",
      cellClassName: "text-zinc-600 dark:text-zinc-400 text-xs font-medium truncate max-w-[110px]",
    },
    {
      key: "lastPaymentAmount",
      header: "Last Paid",
      className: "w-[110px] text-right",
      cellClassName: "font-mono text-right text-xs font-medium text-zinc-700 dark:text-zinc-300",
    },
    {
      key: "totalFeesPaid",
      header: "Total Paid",
      className: "w-[110px] text-right",
      cellClassName: "font-mono text-right text-xs font-semibold text-emerald-700 dark:text-emerald-400",
    },
    {
      key: "totalFeesLeft",
      header: "Fees Owed",
      className: "w-[110px] text-right",
      cell: (row) => {
        const owesMoney = row.rawBalance > 0
        return (
          <span className={`block w-full font-mono text-right text-xs font-bold ${
            owesMoney 
              ? "text-rose-600 dark:text-rose-400" 
              : "text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-300"
          }`}>
            {row.totalFeesLeft}
          </span>
        )
      }
    },
  ]

  if (loading) {
    return (
      <div className="flex h-48 w-full items-center justify-center text-sm text-zinc-500 animate-pulse">
        Loading real-time financial and fee ledger records...
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
      emptyMessage="No financial ledger records found."
    />
  )
}