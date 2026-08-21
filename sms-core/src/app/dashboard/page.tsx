"use client"

import * as React from "react"
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"

export default function DashboardPage() {
  return (
    <div className="w-full px-2 sm:px-4 py-2">
      <DashboardGreeting category="School Operations" title="Dashboard" />
    </div>
  )
}
