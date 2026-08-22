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

      {/* Multifruit Radiant Badge Cluster */}
      <div className="flex items-end gap-1.5 self-center sm:self-end mb-1">
        {/* Multifruit Gradient Circle (Papaya, Dragonfruit & Mango Fusion) */}
        <div className="size-10 sm:size-12 md:size-14 rounded-full bg-gradient-to-tr from-[#FF512F] via-[#F09819] to-[#FF4B2B] text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
          <Asterisk className="size-6 sm:size-7 md:size-8 stroke-[2.5]" />
        </div>

        {/* Passion Fruit / Berry Satellite Pill */}
        <div className="size-5 sm:size-6 rounded-full bg-gradient-to-br from-[#8E2DE2] to-[#4A00E0] text-white flex items-center justify-center shadow-xs">
          <ArrowDownRight className="size-3 sm:size-3.5 stroke-[2.5]" />
        </div>
      </div>
    </div>
  )
}
