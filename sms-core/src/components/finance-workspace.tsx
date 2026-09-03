"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LayoutDashboard, ReceiptText } from "lucide-react"
import FinanceDashboard from "@/components/finance-dashboard"
import FinancialLedgerConsole from "@/components/financial-ledger-console"
import { cn } from "@/lib/utils"

type FinanceViewToken = "dashboard" | "table"

/**
 * Finance page view manager: an always-visible Dashboard / Financial Ledgers
 * switcher (sticky, so it stays reachable while the ledgers scroll) that
 * mirrors the chosen view into the ?view= query param. This is the only
 * place the finance view toggle lives — it is intentionally absent from
 * every other Workspace page.
 */
export default function FinanceWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const view = (searchParams.get("view") as FinanceViewToken | null) ?? "dashboard"

  const setView = React.useCallback(
    (next: FinanceViewToken) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", next)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const views: Array<{ id: FinanceViewToken; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "table", label: "Financial Ledgers", icon: ReceiptText },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sticky switcher — visible at every breakpoint, never an overlay. */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur sm:px-1">
        <div className="inline-flex w-full items-center gap-0.5 rounded-lg bg-muted p-1 sm:w-auto">
          {views.map(({ id, label, icon: Icon }) => {
            const isActive = view === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all sm:min-h-8 sm:flex-none sm:text-xs",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 py-4 sm:py-5">
        {view === "dashboard" ? <FinanceDashboard /> : <FinancialLedgerConsole />}
      </div>
    </div>
  )
}
