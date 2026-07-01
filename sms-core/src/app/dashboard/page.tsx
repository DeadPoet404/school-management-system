  import React from 'react'
  import { UniversalBarChart, ChartDataPoint, MetricConfig } from '@/components/universal-bar-chart'
  import { UniversalAreaMiniChart } from '@/components/universal-area-mini-chart'
  import { UniversalLineMiniChart } from '@/components/universal-line-mini-chart'
  import { UniversalBarMiniChart } from '@/components/universal-bar-mini-chart'


  // Deep time-series mock dataset containing 47 sequential tracking dates
  const platformData: ChartDataPoint[] = [
    { date: "2026-05-01", platformFee: 220, transactions: 150 },
    { date: "2026-05-02", platformFee: 197, transactions: 180 },
    { date: "2026-05-03", platformFee: 267, transactions: 120 },
    { date: "2026-05-04", platformFee: 342, transactions: 260 },
    { date: "2026-05-05", platformFee: 473, transactions: 290 },
    { date: "2026-05-06", platformFee: 401, transactions: 340 },
    { date: "2026-05-07", platformFee: 345, transactions: 180 },
    { date: "2026-05-08", platformFee: 509, transactions: 320 },
    { date: "2026-05-09", platformFee: 159, transactions: 110 },
    { date: "2026-05-10", platformFee: 361, transactions: 190 },
    { date: "2026-05-11", platformFee: 427, transactions: 350 },
    { date: "2026-05-12", platformFee: 392, transactions: 210 },
    { date: "2026-05-13", platformFee: 442, transactions: 380 },
    { date: "2026-05-14", platformFee: 237, transactions: 220 },
    { date: "2026-05-15", platformFee: 220, transactions: 170 },
    { date: "2026-05-16", platformFee: 238, transactions: 190 },
    { date: "2026-05-17", platformFee: 546, transactions: 360 },
    { date: "2026-05-18", platformFee: 464, transactions: 410 },
    { date: "2026-05-19", platformFee: 343, transactions: 180 },
    { date: "2026-05-20", platformFee: 277, transactions: 230 },
    { date: "2026-05-21", platformFee: 182, transactions: 140 },
    { date: "2026-05-22", platformFee: 181, transactions: 120 },
    { date: "2026-05-23", platformFee: 352, transactions: 290 },
    { date: "2026-05-24", platformFee: 487, transactions: 290 },
    { date: "2026-05-25", platformFee: 315, transactions: 250 },
    { date: "2026-05-26", platformFee: 175, transactions: 130 },
    { date: "2026-05-27", platformFee: 483, transactions: 420 },
    { date: "2026-05-28", platformFee: 222, transactions: 180 },
    { date: "2026-05-29", platformFee: 415, transactions: 240 },
    { date: "2026-05-30", platformFee: 554, transactions: 380 },
    { date: "2026-05-31", platformFee: 265, transactions: 220 },
    { date: "2026-06-01", platformFee: 420, transactions: 210 },
    { date: "2026-06-02", platformFee: 380, transactions: 190 },
    { date: "2026-06-03", platformFee: 510, transactions: 320 },
    { date: "2026-06-04", platformFee: 490, transactions: 280 },
    { date: "2026-06-05", platformFee: 620, transactions: 410 },
    { date: "2026-06-06", platformFee: 580, transactions: 390 },
    { date: "2026-06-07", platformFee: 690, transactions: 510 },
    { date: "2026-06-08", platformFee: 440, transactions: 310 },
    { date: "2026-06-09", platformFee: 495, transactions: 360 },
    { date: "2026-06-10", platformFee: 520, transactions: 440 },
    { date: "2026-06-11", platformFee: 610, transactions: 490 },
    { date: "2026-06-12", platformFee: 575, transactions: 420 },
    { date: "2026-06-13", platformFee: 410, transactions: 290 },
    { date: "2026-06-14", platformFee: 430, transactions: 330 },
    { date: "2026-06-15", platformFee: 550, transactions: 410 },
    { date: "2026-06-16", platformFee: 680, transactions: 520 },
  ]

  // Standardized Core Colors: 
  // Hero Orange: #E85002 | Dark Zinc Neutral: #18181b | Muted Zinc: #71717a
  const platformMetrics: MetricConfig[] = [
    { key: "platformFee", label: "Platform Revenue", color: "#E85002" },
    { key: "transactions", label: "Volume Metrics", color: "#18181b" },
  ]

  export default function DashboardPage() {
    return (
      <div className="flex flex-col gap-4 p-2 md:p-1">
      
        {/* Universal Interactive Chart View Engine */}
        <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
          <UniversalBarChart 
            title="Overview"
            description="Operational metrics and volume analytics across the instance lifecycle."
            data={platformData}
            metrics={platformMetrics}
            defaultMetricKey="platformFee"
          />
        </div>
        
        {/* Visual Hierarchy Layout centered on the primary Orange accent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Slot 1: Stacked Layered Area Layout — Hero base orange overlapping with dark tracking text */}
          <UniversalAreaMiniChart
            title="Yield vs Volume"
            subtitle="Revenue mapped directly against runs"
            data={platformData}
            dataKey="platformFee"
            secondaryDataKey="transactions"
            color="#E85002"
            secondaryColor="#18181b"
            height={135}
          />

          {/* Slot 2: Secondary metric as a crisp, structural dark neutral */}
          <UniversalLineMiniChart
            title="Transaction Runs"
            subtitle="Total volume operations processed"
            data={platformData}
            dataKey="transactions"
            color="#18181b"
            height={135}
          />
          
          {/* Slot 3: Mini Bar Chart uses the clean core accent color */}
          <UniversalBarMiniChart
            title="Average Yield"
            subtitle="Relative profit margins across windows"
            data={platformData}
            dataKey="platformFee"
            color="#E85002"
            height={135}
          />
          
          {/* Slot 4: Muted slate-zinc distribution component so it blends elegantly into the background */}
          <UniversalBarMiniChart
            title="Average Yield"
            subtitle="Relative profit margins across windows"
            data={platformData}
            dataKey="platformFee"
            color="#18181b"
            height={135}
          />
        </div>

      </div>
    )
  }
