"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, ReceiptText } from "lucide-react"

export function ViewToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  // FIX: Changed fallback to 'dashboard' to perfectly match your page's fresh load state
  const currentView = searchParams.get("view") || "dashboard"

  const setView = (viewToken: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", viewToken)
    // Clear phase shifting by ensuring route updates relative to pathname cleanly without scroll reset
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="inline-flex items-center rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 gap-0.5 select-none shadow-xs">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setView("dashboard")}
        className={`h-7 text-xs font-medium px-3 gap-1.5 rounded-md transition-all ${
          currentView === "dashboard"
            ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/20 dark:bg-zinc-950 dark:text-zinc-50 dark:border-zinc-800/40"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        <span>Dashboard</span>
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setView("table")}
        className={`h-7 text-xs font-medium px-3 gap-1.5 rounded-md transition-all ${
          currentView === "table"
            ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/20 dark:bg-zinc-950 dark:text-zinc-50 dark:border-zinc-800/40"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        <ReceiptText className="h-3.5 w-3.5" />
        <span>Financial Ledgers</span>
      </Button>
    </div>
  )
}