"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { UniversalSearch } from "@/components/universal-search"
import { Button } from "@/components/ui/button"
import { AddIcon, DownloadIcon } from "@/components/custom-icon"
import { ModuleTabs, type ModuleTab } from "@/components/module-tabs"
import {
  DynamicFilterPopover,
  type FilterField,
} from "@/components/dynamic-filter-popover"
import { Toaster } from "@/components/ui/sonner"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { FinanceActionSheet, type LedgerActionToken } from "@/components/finance/finance-action-sheet"

// --- DOMAIN DATA-TABLE MODULES ---
import { InvoicesTable } from "@/components/invoices-table"
import { CollectionsTable } from "@/components/collections-table"
import { PayrollTable } from "./payroll-table"
import { ExpensesTable } from "./expenses-table"

type LedgerTabToken = "invoices" | "collections" | "payroll" | "expenses"

interface LedgerConfigProperties {
  heading: string
  actionText: string
  actionLabel: LedgerActionToken
}

const ENTITY_LEDGER_CONFIG: Record<LedgerTabToken, LedgerConfigProperties> = {
  invoices: {
    heading: "Fee Structures & Invoices",
    actionText: "Create Invoice",
    actionLabel: "invoices",
  },
  collections: {
    heading: "Collections & Payment Receipts",
    actionText: "Record Payment",
    actionLabel: "collections",
  },
  payroll: {
    heading: "Staff Payroll Ledgers",
    actionText: "Run Payroll",
    actionLabel: "payroll",
  },
  expenses: {
    heading: "Expense Logs & Outflows",
    actionText: "Log Expense",
    actionLabel: "expenses",
  },
}

// Filter schemas match the real row fields surfaced in each ledger table.
const LEDGER_FILTER_SCHEMAS: Record<LedgerTabToken, FilterField[]> = {
  invoices: [
    {
      id: "status",
      label: "Invoice Clearing State",
      type: "checkbox-group",
      options: ["Paid", "Partial", "Overdue"],
    },
    {
      id: "minBalance",
      label: "Minimum Outstanding Balance (GH₵)",
      type: "number",
      min: 0,
      placeholder: "Show invoices with balances above…",
    },
  ],
  collections: [
    {
      id: "paymentMethod",
      label: "Payment Method",
      type: "text",
      placeholder: "e.g. Mobile Money, Cash…",
    },
  ],
  payroll: [
    {
      id: "status",
      label: "Disbursement State",
      type: "checkbox-group",
      options: ["Paid", "Processing", "On Hold"],
    },
    {
      id: "minNetPay",
      label: "Minimum Net Pay (GH₵)",
      type: "number",
      min: 0,
      placeholder: "Show payslips above…",
    },
  ],
  expenses: [
    {
      id: "status",
      label: "Authorization State",
      type: "checkbox-group",
      options: ["Cleared", "Pending Approval", "Rejected"],
    },
    {
      id: "category",
      label: "Category",
      type: "text",
      placeholder: "e.g. Utilities, Maintenance…",
    },
    {
      id: "minThreshold",
      label: "Minimum Amount (GH₵)",
      type: "number",
      min: 0,
      placeholder: "Show payments greater than…",
    },
  ],
}

const CSV_EXPORT_RESOURCE: Record<LedgerTabToken, { path: string; filename: string }> = {
  invoices: { path: "/finance/invoices", filename: "finance-invoices.csv" },
  collections: { path: "/finance/collections", filename: "finance-collections.csv" },
  payroll: { path: "/finance/payroll", filename: "finance-payroll.csv" },
  expenses: { path: "/finance/expenses", filename: "finance-expenses.csv" },
}

export default function FinancialLedgerConsole() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<LedgerTabToken>("invoices")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({})
  const [ledgerPage, setLedgerPage] = useState(1)
  const [actionTab, setActionTab] = useState<LedgerActionToken | null>(null)
  const [exporting, setExporting] = useState(false)

  const currentTabContext = useMemo<LedgerConfigProperties>(() => {
    return ENTITY_LEDGER_CONFIG[activeTab]
  }, [activeTab])

  // Full-fidelity data models containing explicit titles and summaries for the ModuleTabs hover panel
  const tabOptions = useMemo<ModuleTab[]>(() => [
    {
      value: "invoices",
      label: "Invoices",
      title: "Fee Billing & Accounts Receivable",
      description: "Manage tuition frameworks, issue student bills, track balances, and audit overall clearing status across institutional academic tiers."
    },
    {
      value: "collections",
      label: "Collections",
      title: "Payment Collection & Receipts Channel",
      description: "Track realtime transaction clearing matching bank logs, mobile money settlements, and print verified digital balance vouchers."
    },
    {
      value: "payroll",
      label: "Payroll",
      title: "Staff Remittance & Cost Distribution",
      description: "Process core salary registers, monitor allowance points, manage deductions, and review compensation ledger branches."
    },
    {
      value: "expenses",
      label: "Expenses",
      title: "Procurement Outflows & Asset Budgets",
      description: "Log facility maintenance costs, track vendor payouts, process supply requests, and verify balance authorization tiers."
    },
  ], [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setLedgerPage(1)
  }, [])

  const handleApplyFilters = useCallback(
    (filterPayload: Record<string, unknown>) => {
      setAppliedFilters(filterPayload || {})
      setLedgerPage(1)
    },
    []
  )

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as LedgerTabToken)
    setSearchQuery("")
    setAppliedFilters({})
    setLedgerPage(1)
  }, [])

  const handleActionClose = useCallback(() => {
    setActionTab(null)
    // Any ledger data may have changed while the action sheet was open.
    void queryClient.invalidateQueries({ queryKey: ["finance"] })
  }, [queryClient])

  const handleExportCsv = useCallback(async () => {
    const { path, filename } = CSV_EXPORT_RESOURCE[activeTab]

    if (exporting) return
    setExporting(true)
    try {
      const response = await fetchWithAuth(`${path}?format=csv`)

      if (!response.ok) {
        throw new Error(`Export failed (HTTP ${response.status}).`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      toast.success("Export Ready", {
        description: `${filename} downloaded.`,
      })
    } catch (error) {
      toast.error("Export Failed", {
        description:
          error instanceof Error
            ? error.message
            : "Could not reach backend service layers.",
      })
    } finally {
      setExporting(false)
    }
  }, [activeTab, exporting])

  const tableProps = {
    searchQuery,
    filters: appliedFilters,
    page: ledgerPage,
    onPageChange: setLedgerPage,
  }

  return (
    <div className="w-full pt-4 pl-1 bg-transparent sm:pt-6 sm:pl-3">
      <Toaster position="top-right" />
      <div className="px-3 sm:pl-3 sm:pr-6">

        {/* Main Header Module Viewport Container */}
        <div className="space-y-1">
          <h1 className="text-2xl tracking-tight font-semibold text-foreground sm:text-4xl">
            School Finance Database
          </h1>
          <p className="max-w-[700px] text-xs text-muted-foreground sm:text-sm">
            Centralized accounting console for global rules, invoicing generation, fee collections auditing, and operating expenditures.
          </p>
        </div>

        {/* Dynamic Control Action & Search Utility Row */}
        <div className="flex w-full flex-col gap-3 pt-5 pb-3 lg:flex-row lg:items-center lg:justify-between lg:pt-8 lg:gap-4">
          {/* Section Dynamic Label Viewport Indicator */}
          <p className="text-lg tracking-tight text-foreground font-medium whitespace-nowrap lg:text-xl">
            {currentTabContext.heading}
          </p>

          {/* Context Action Matrix */}
          <div className="flex flex-wrap items-center gap-2.5 lg:gap-4">
            {/* Search and Parametric Selection Pipeline */}
            <div className="flex w-full items-center gap-2 lg:w-auto">
              <UniversalSearch
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={`Search ${currentTabContext.heading.toLowerCase()}…`}
                className="w-full lg:w-[220px]"
              />
              <DynamicFilterPopover
                fields={LEDGER_FILTER_SCHEMAS[activeTab]}
                onApplyFilters={handleApplyFilters}
                triggerLabel=""
                className="h-11! w-11! shrink-0 rounded-md lg:h-9! lg:w-9!"
              />
            </div>

            {/* Ledger Utility Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => void handleExportCsv()}
                disabled={exporting}
                className="h-11 w-11 rounded-md bg-[#fafafa] text-stone-500 border border-stone-200 transition-colors shadow-none outline-none focus:ring-0 focus-visible:ring-0 hover:bg-[#f0f0f0] focus:bg-[#f0f0f0] active:bg-[#f0f0f0] dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 lg:h-9 lg:w-9"
                aria-label="Export active ledger as CSV"
                title="Export active ledger as CSV"
              >
                <DownloadIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Primary Ledger Action Trigger */}
            <Button
              size="sm"
              type="button"
              onClick={() => setActionTab(currentTabContext.actionLabel)}
              className="h-11 rounded-lg font-medium shadow-xs lg:h-9"
            >
              <AddIcon className="mr-2 h-4 w-4" />
              {currentTabContext.actionText}
            </Button>
          </div>
        </div>

        {/* Structural Entity Switcher Navigation Line */}
        <div className="pt-3 pb-4">
          <ModuleTabs
            tabs={tabOptions}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>

        {/* Dynamic Target Workspace Context Nodes */}
        <div className="pt-2">
          {activeTab === "invoices" && <InvoicesTable {...tableProps} />}
          {activeTab === "collections" && <CollectionsTable {...tableProps} />}
          {activeTab === "payroll" && <PayrollTable {...tableProps} />}
          {activeTab === "expenses" && <ExpensesTable {...tableProps} />}
        </div>

      </div>

      {actionTab ? (
        <FinanceActionSheet tab={actionTab} onClose={handleActionClose} />
      ) : null}
    </div>
  )
}
