// app/finance/page.tsx
import * as React from "react"
import FinanceOverviewAnalytics from "@/components/finance-overview-analytics"
import FinancialLedgerConsole from "@/components/financial-ledger-console"

// 1. STRONGLY TYPED MATRIX VIEWS
type FinanceViewToken = "dashboard" | "table" | "payroll" | "ledgers"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function FinancePage({ searchParams }: PageProps) {
  // Resolve asynchronous Next.js search parameter stream
  const resolvedParams = await searchParams
  const viewToken = (resolvedParams.view as FinanceViewToken) || "dashboard"

  // 2. SCALABLE VIEW MAPPING ENGINE
  // Easily register future sub-modules here without breaking layout flows
  switch (viewToken) {
    case "table":
      return <FinancialLedgerConsole />
      
    // Case handles for future core layout expansions:
    // case "payroll":
    //   return <PayrollLedgersView initialTab="payroll" />
    // case "ledgers":
    //   return <PayrollLedgersView initialTab="ledgers" />

    case "dashboard":
    default:
      return <FinanceOverviewAnalytics />
  }
}