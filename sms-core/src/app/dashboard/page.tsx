"use client"

import * as React from "react"
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"

export default function DashboardPage() {
  return (
    <div className="w-full px-2 sm:px-4 py-3 flex flex-col gap-6">
      
      {/* 1. Header Greeting */}
      <DashboardGreeting category="School Operations" title="Dashboard" />

      {/* 2. Wireframe Grid Structure */}
      <div className="flex flex-col gap-5 sm:gap-6">
        
        {/* ROW 1: 3 Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Row 1 - Section 1 */}
          <div className="min-h-[240px] sm:min-h-[280px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 1 · Section 1
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Left Primary Block ]
            </span>
          </div>

          {/* Row 1 - Section 2 */}
          <div className="min-h-[240px] sm:min-h-[280px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 1 · Section 2
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Middle Analytics / KPI Block ]
            </span>
          </div>

          {/* Row 1 - Section 3 */}
          <div className="min-h-[240px] sm:min-h-[280px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 1 · Section 3
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Right Chart / Target Block ]
            </span>
          </div>
        </div>

        {/* ROW 2: 3 Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Row 2 - Section 1 */}
          <div className="min-h-[240px] sm:min-h-[280px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 2 · Section 1
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Lower Left Widget ]
            </span>
          </div>

          {/* Row 2 - Section 2 */}
          <div className="min-h-[240px] sm:min-h-[280px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Row 2 · Section 2
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
              [ Lower Middle Action Feed / Registry ]
            </span>
          </div>

          {/* Row 2 - Section 3 */}
          <div className="min-h-[240px] sm:min-h-[280px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center p-6 text-center transition-colors">
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
