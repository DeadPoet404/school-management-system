"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"

import { FeeStructureInvoiceConfig } from "@/components/fee-structure-invoice-config"
import { PaymentInflowCollectionLog } from "@/components/payment-inflow-collection-log"
import { PayrollLedgersView } from "@/components/payroll-ledgers-view"
import { ExpenseLogForm } from "@/components/finance/expense-log-form"

export type LedgerActionToken = "invoices" | "collections" | "payroll" | "expenses"

const ACTION_HEADINGS: Record<LedgerActionToken, { title: string; subtitle: string }> = {
  invoices: {
    title: "Fee Structures & Invoicing Setup",
    subtitle: "Design fee components per grade tier, then generate invoices for a section.",
  },
  collections: {
    title: "Record a Cash Payment",
    subtitle: "Log an inflow for a student against a section fee allocation.",
  },
  payroll: {
    title: "Payroll & Ledger Disbursements",
    subtitle: "Review payroll registers, disburse pending records, and manage ledger accounts.",
  },
  expenses: {
    title: "Log an Operating Expense",
    subtitle: "Create a procurement outflow entry for approval.",
  },
}

interface FinanceActionSheetProps {
  tab: LedgerActionToken
  onClose: () => void
}

export function FinanceActionSheet({ tab, onClose }: FinanceActionSheetProps) {
  const { title, subtitle } = ACTION_HEADINGS[tab]

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full! gap-0! p-0! sm:max-w-[64rem]!"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-transparent">
          {tab === "invoices" ? <FeeStructureInvoiceConfig /> : null}
          {tab === "collections" ? <PaymentInflowCollectionLog /> : null}
          {tab === "payroll" ? <PayrollLedgersView /> : null}
          {tab === "expenses" ? <ExpenseLogForm onSaved={onClose} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
