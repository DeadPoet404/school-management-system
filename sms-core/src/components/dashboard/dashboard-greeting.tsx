"use client"

import * as React from "react"
import { Asterisk, ArrowDownRight } from "lucide-react"

interface DashboardGreetingProps {
  category?: string
  title?: string
}

export function DashboardGreeting({
  category = "School Operations",
  title = "Dashboard",
}: DashboardGreetingProps) {
  return (
    <div className="flex items-center gap-3.5 sm:gap-4 py-2 select-none">
      {/* Two-tier clean typography stack */}
      <div className="flex flex-col">
        <span className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight text-neutral-400 dark:text-neutral-500 leading-none">
          {category}
        </span>
        <span className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-900 dark:text-neutral-50 leading-none mt-1.5">
          {title}
        </span>
      </div>

      {/* Modern Neon Asterisk + Satellite Arrow Badge */}
      <div className="flex items-end gap-1.5 self-center sm:self-end mb-1">
        {/* Neon Lime Circle */}
        <div className="size-10 sm:size-12 md:size-14 rounded-full bg-[#D8FA36] text-black flex items-center justify-center font-bold shadow-xs">
          <Asterisk className="size-6 sm:size-7 md:size-8 stroke-[2.5]" />
        </div>

        {/* Dark Satellite Sub-Badge */}
        <div className="size-5 sm:size-6 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black flex items-center justify-center shadow-xs">
          <ArrowDownRight className="size-3 sm:size-3.5 stroke-[2.5]" />
        </div>
      </div>
    </div>
  )
}
