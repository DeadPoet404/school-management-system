"use client"

import * as React from "react"

import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"
import { DashboardTreasuryCard } from "@/components/dashboard/dashboard-treasury-card"
import { ChartBarStacked } from "@/components/dashboard/dashboard-cashflow-chart"
import { DashboardReceivablesCard } from "@/components/dashboard/dashboard-receivables-card"

import { DashboardAttendanceCard } from "@/components/dashboard/dashboard-attendance-card"
import { DashboardStudentsCard } from "@/components/dashboard/dashboard-students-card"
import { DashboardPayrollCard } from "@/components/dashboard/dashboard-payroll-card"

export default function DashboardPage() {
  return (
    <div className="w-full px-2 py-3 sm:px-4">

      {/* ============================================================
          DASHBOARD HEADER
      ============================================================ */}

      <DashboardGreeting
        category="School Operations"
        title="Dashboard"
      />


      <div className="mt-6 flex flex-col gap-5 sm:gap-6">

        {/* ============================================================
            ROW 1 — FINANCIAL COMMAND CENTER

            Treasury       3 columns
            Cashflow        6 columns
            Receivables     3 columns

            Kept deliberately tall because these are the primary
            financial working surfaces of the dashboard.
        ============================================================ */}

        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:h-[620px] lg:grid-cols-12">

          {/* Treasury */}
          <div className="flex min-h-0 flex-col lg:col-span-3">

            <DashboardTreasuryCard
              totalRevenue={689372}
              trendPct={5.4}
              spentBudget={180000}
              totalBudget={350000}
              onCollectPayment={() =>
                window.location.assign("/finance")
              }
              onIssueInvoice={() =>
                window.location.assign("/finance")
              }
            />

          </div>


          {/* Cashflow */}
          <div className="flex min-h-0 flex-col lg:col-span-6">

            <ChartBarStacked />

          </div>


          {/* Receivables */}
          <div className="flex min-h-0 flex-col lg:col-span-3">

            <DashboardReceivablesCard />

          </div>

        </section>


        {/* ============================================================
            ROW 2 — DAILY OPERATIONS

            Attendance     1/3
            Students       1/3
            Payroll        1/3

            These are deliberately shorter than Row 1. They answer
            the everyday operational questions without competing
            with the financial command center.
        ============================================================ */}

        <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">

          {/* Attendance */}
          <div className="min-w-0">

            <DashboardAttendanceCard />

          </div>


          {/* Student Population */}
          <div className="min-w-0">

            <DashboardStudentsCard />

          </div>


          {/* Payroll */}
          <div className="min-w-0">

            <DashboardPayrollCard />

          </div>

        </section>

      </div>

    </div>
  )
}