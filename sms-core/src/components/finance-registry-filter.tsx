"use client"

import * as React from "react"
import { DynamicFilterPopover, type FilterField } from "@/components/dynamic-filter-popover"

// --- Domain Vocabulary Mappings for Financial Ledgers ---
const TRANSACTION_STATUS_OPTIONS = ["Settled", "Pending", "Overdue", "Disputed"] as const
const PAYMENT_METHOD_OPTIONS = ["Bank Wire Transfer", "Mobile Money (MoMo)", "Cash Payment", "Cheque Settlement"] as const

const LEDGER_CATEGORIES = [
  "Tuition & Core Academic",
  "Operational Expenses",
  "Payroll & Remittance",
  "Infrastructure & IT",
  "Supplies & Maintenance",
  "Extra-Curricular Allocation"
] as const

// --- Schema Definitions for Finance Advanced Search Architecture ---
const financeFilterFields: FilterField[] = [
  {
    id: "transactionStatus",
    label: "Clearing / Reconciliation Status",
    type: "checkbox-group",
    options: TRANSACTION_STATUS_OPTIONS,
  },
  {
    id: "paymentMethod",
    label: "Remittance Route Channel",
    type: "combobox",
    placeholder: "Select payment method...",
    options: PAYMENT_METHOD_OPTIONS,
  },
  {
    id: "ledgerCategory",
    label: "Treasury Allocation Category",
    type: "combobox",
    placeholder: "Select target ledger stream...",
    options: LEDGER_CATEGORIES,
  },
  {
    id: "minAmount",
    label: "Transaction Cost Floor Limit ($)",
    type: "number",
    min: 0,
    placeholder: "Show transactions greater than or equal to...",
  },
]

interface FinanceRegistryFilterProps {
  onApplyFilters: (filters: Record<string, any>) => void
}

export function FinanceRegistryFilter({ onApplyFilters }: FinanceRegistryFilterProps) {
  const handleApply = (appliedValues: Record<string, any>) => {
    // Normalizes empty string allocations before lifting criteria back up to parent components
    const processedFilters = Object.fromEntries(
      Object.entries(appliedValues).filter(([_, val]) => val !== "" && val !== null)
    )
    
    console.log("Finance workspace criteria executed:", processedFilters)
    onApplyFilters(processedFilters)
  }

  return (
    <DynamicFilterPopover
      fields={financeFilterFields}
      onApplyFilters={handleApply}
      triggerLabel=""
      className="border-0 w-9 p-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-900"
      align="end"
    />
  )
}