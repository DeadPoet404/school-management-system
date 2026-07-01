"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { UniversalSearch } from "@/components/universal-search"
import { Button } from "@/components/ui/button"
import { AddIcon, DownloadIcon } from "@/components/custom-icon"
import { ActionDropdown, type ActionDropdownItem } from "@/components/action-dropdown"
import { ModuleTabs, type ModuleTab } from "@/components/module-tabs" 
import { DynamicFilterPopover, type FilterField } from "@/components/dynamic-filter-popover"

// Utility Icons for Dropdown Payload Matrix
import { FileSpreadsheet, FileText, Settings } from "lucide-react"

// --- DOMAIN DATA-TABLE MODULES ---
import { InvoicesTable } from "@/components/invoices-table"
import { CollectionsTable } from "@/components/collections-table"
import { PayrollTable } from "./payroll-table"
import { ExpensesTable } from "./expenses-table"

type LedgerTabToken = "invoices" | "collections" | "payroll" | "expenses"

interface LedgerConfigProperties {
  heading: string
  actionText: string
}

const ENTITY_LEDGER_CONFIG: Record<LedgerTabToken, LedgerConfigProperties> = {
  invoices: {
    heading: "Fee Structures & Invoices",
    actionText: "Create Invoice",
  },
  collections: {
    heading: "Collections & Payment Receipts",
    actionText: "Record Payment",
  },
  payroll: {
    heading: "Staff Payroll Ledgers",
    actionText: "Run Payroll",
  },
  expenses: {
    heading: "Expense Logs & Outflows",
    actionText: "Log Expense",
  },
}

const LEDGER_FILTER_SCHEMAS: Record<LedgerTabToken, FilterField[]> = {
  invoices: [
    {
      id: "invoiceStatus",
      label: "Invoice Clearing State",
      type: "checkbox-group",
      options: ["Paid", "Pending", "Overdue"]
    },
    {
      id: "academicTier",
      label: "Academic Cohort Target Zone",
      type: "combobox",
      placeholder: "Select academic level profile...",
      options: [
        "Kindergarten / Lower Primary",
        "Upper Primary",
        "Junior High School (JHS)",
        "Senior High School (SHS)",
        "Advanced / Post-Grad Tier"
      ]
    }
  ],
  collections: [
    {
      id: "paymentMethod",
      label: "Payment Route Channel",
      type: "checkbox-group",
      options: ["Bank Wire", "Mobile Money"]
    },
    {
      id: "allocationCategory",
      label: "Remittance Allocation Ledger",
      type: "combobox",
      placeholder: "Select treasury target category...",
      options: [
        "Tuition & Core Academic",
        "Laboratory & IT Infrastructure",
        "Medical & Health Services",
        "Sports & Extra-Curricular",
        "Library & Resource Center"
      ]
    }
  ],
  payroll: [
    {
      id: "staffProfile",
      label: "Staff Deployment Matrix",
      type: "checkbox-group",
      options: ["Faculty", "Admin", "Operations"]
    },
    {
      id: "department",
      label: "Cost Center Department",
      type: "combobox",
      placeholder: "Select clearing branch...",
      options: [
        "Administration & Registry",
        "Faculty of Computer Science",
        "Department of Mathematics",
        "Department of Natural Sciences",
        "Logistics & Operations Support"
      ]
    }
  ],
  expenses: [
    {
      id: "expenseStatus",
      label: "Authorization State",
      type: "checkbox-group",
      options: ["Cleared", "Pending Approval", "Rejected"]
    },
    {
      id: "expenseCategory",
      label: "Operational Expense Pillar",
      type: "combobox",
      placeholder: "Select procurement stream...",
      options: ["Utilities", "Maintenance", "Supplies", "Equipment", "Logistics"]
    },
    {
      id: "minThreshold",
      label: "Outflow Cost Floor Limit (GH₵)",
      type: "number",
      min: 0,
      placeholder: "Show payments greater than amount (e.g. 500)"
    }
  ]
}

export default function FinancialLedgerConsole() {
  const [activeTab, setActiveTab] = useState<LedgerTabToken>("invoices")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const currentTabContext = useMemo<LedgerConfigProperties>(() => {
    return ENTITY_LEDGER_CONFIG[activeTab]
  }, [activeTab])

  // Context-specific dropdown items payload definition
  const dropdownActions = useMemo<ActionDropdownItem[]>(() => [
    {
      label: "Export to Excel (.xlsx)",
      icon: FileSpreadsheet,
      onClick: () => console.log(`Exporting ${activeTab} as Excel template record...`),
    },
    {
      label: "Generate Audit Trail (.pdf)",
      icon: FileText,
      onClick: () => console.log(`Compiling transaction ledger audit pipeline for ${activeTab}...`),
    },
    {
      label: "Ledger Rule Settings",
      icon: Settings,
      onClick: () => console.log(`Opening configuration schema for context segment: ${activeTab}`),
    },
  ], [activeTab])

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

  const handleApplyFilters = (filterPayload: Record<string, any>) => {
    console.log(`Applying criteria context payload for [${activeTab}]:`, filterPayload)
  }

  return (
    <div className="w-full pt-6 pl-3 bg-transparent">
      <div className="pl-3 pr-6">
        
        {/* Main Header Module Viewport Container */}
        <div className="space-y-1">
          <h1 className="text-4xl tracking-tight font-semibold text-foreground">
            School Finance Database
          </h1>
          <p className="text-sm text-muted-foreground max-w-[700px]">
            Centralized accounting console for global rules, invoicing generation, fee collections auditing, and operating expenditures.
          </p>
        </div>
        
        {/* Dynamic Control Action & Search Utility Row */}
        <div className="flex items-center justify-between pt-8 pb-3 w-full border-b border-transparent">
          {/* Section Dynamic Label Viewport Indicator */}
          <p className="text-xl tracking-tight text-foreground font-medium whitespace-nowrap">
            {currentTabContext.heading}
          </p>
          
          {/* Context Action Matrix */}
          <div className="flex items-center gap-4">
            {/* Search and Parametric Selection Pipeline */}
            <div className="flex items-center gap-2">
              <UniversalSearch 
                value={searchQuery} 
                onChange={(value: string) => setSearchQuery(value)} 
                placeholder={`Search ${currentTabContext.heading.toLowerCase()}...`}
              />
              <DynamicFilterPopover 
                fields={LEDGER_FILTER_SCHEMAS[activeTab]} 
                onApplyFilters={handleApplyFilters} 
              />
            </div>

            {/* Ledger Utility Controls */}
            <div className="flex items-center gap-2">
              <ActionDropdown menuLabel="Batch Context Operations" items={dropdownActions} />
              
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md bg-[#fafafa] text-stone-500 border border-stone-200 transition-colors shadow-none outline-none focus:ring-0 focus-visible:ring-0 hover:bg-[#f0f0f0] focus:bg-[#f0f0f0] active:bg-[#f0f0f0] dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                aria-label="Export financial statement template"
              >
                <DownloadIcon className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Primary Ledger Action Trigger */}
            <Button size="sm" className="h-9 rounded-lg font-medium shadow-xs">
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
            onTabChange={(tab: string) => {
              setActiveTab(tab as LedgerTabToken)
              setSearchQuery("") 
            }} 
          />
        </div>

        {/* Dynamic Target Workspace Context Nodes */}
        <div className="pt-2">
          {activeTab === "invoices" && <InvoicesTable />}
          {activeTab === "collections" && <CollectionsTable />}
          {activeTab === "payroll" && <PayrollTable />}
          {activeTab === "expenses" && <ExpensesTable />}
        </div>
        
      </div>
    </div>
  )
}