"use client"

import * as React from "react"
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"
import { DashboardTreasuryCard } from "@/components/dashboard/dashboard-treasury-card"
import { ChartBarStacked } from "@/components/dashboard/dashboard-cashflow-chart"

export default function DashboardPage() {
  return (
    <div className="w-full px-2 sm:px-4 py-3 flex flex-col gap-6">
      
      {/* 1. Header Greeting */}
      <DashboardGreeting category="School Operations" title="Dashboard" />

      {/* 2. Wireframe Grid Structure */}
      <div className="flex flex-col gap-5 sm:gap-6">
        
        {/* ROW 1: Asymmetric 3-Section Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
          
          {/* Row 1 - Section 1 (Treasury Card: 3 cols) */}
          <div className="lg:col-span-3 min-h-[470px] sm:min-h-[550px] flex flex-col">
            <DashboardTreasuryCard
              totalRevenue={689372}
              trendPct={5.4}
              spentBudget={180000}
              totalBudget={350000}
              onCollectPayment={() => window.location.assign("/finance")}
              onIssueInvoice={() => window.location.assign("/finance")}
            />
          </div>

          {/* Row 1 - Section 2 (Expanded Middle: 6 cols with Stacked Bar Chart) */}
          <div className="lg:col-span-6 min-h-[470px] sm:min-h-[550px] flex flex-col">
            <ChartBarStacked />
          </div>

          {/* Row 1 - Section 3 (Compact Right: 3 cols) */}
          <div className="lg:col-span-3 min-h-[470px] sm:min-h-[550px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 1 · Section 3
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Right Compact Block · 25% ]
            </span>
          </div>
        </div>

        {/* ROW 2: 3 Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Row 2 - Section 1 */}
          <div className="min-h-[360px] sm:min-h-[420px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 2 · Section 1
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Lower Left Widget ]
            </span>
          </div>

          {/* Row 2 - Section 2 */}
          <div className="min-h-[360px] sm:min-h-[420px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 2 · Section 2
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Lower Middle Action Feed / Registry ]
            </span>
          </div>

          {/* Row 2 - Section 3 */}
          <div className="min-h-[360px] sm:min-h-[420px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 2 · Section 3
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Lower Right Log / Summary ]
            </span>
          </div>
        </div>

      </div>

    </div>
  )
}
