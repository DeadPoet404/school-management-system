 "use client"
 import React, { useEffect, useState } from 'react'
  import { UniversalBarChart, ChartDataPoint, MetricConfig } from '@/components/universal-bar-chart'
  import { UniversalAreaMiniChart } from '@/components/universal-area-mini-chart'
  import { UniversalLineMiniChart } from '@/components/universal-line-mini-chart'
  import { UniversalBarMiniChart } from '@/components/universal-bar-mini-chart'
  import { fetchWithAuth } from '@/lib/fetch-with-auth'

  export default function DashboardPage() {
    const [data, setData] = useState<ChartDataPoint[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      async function loadMetrics() {
        try {
          setIsLoading(true)
          setError(null)

          const [studentsRes, teachersRes, staffRes] = await Promise.all([
            fetchWithAuth("/students?limit=1"),
            fetchWithAuth("/teachers?limit=1"),
            fetchWithAuth("/staff?limit=1"),
          ])

          const [studentsData, teachersData, staffData] = await Promise.all([
            studentsRes.json(),
            teachersRes.json(),
            staffRes.json(),
          ])

          const studentTotal = studentsData.total ?? studentsData.pagination?.total ?? 0
          const teacherTotal = teachersData.total ?? teachersData.pagination?.total ?? 0
          const staffTotal = staffData.total ?? staffData.pagination?.total ?? 0

          setData([
            { date: "Students", population: studentTotal, personnel: teacherTotal, support: staffTotal },
            { date: "Teachers", population: studentTotal, personnel: teacherTotal, support: staffTotal },
            { date: "Staff", population: studentTotal, personnel: teacherTotal, support: staffTotal },
          ])
        } catch {
          setError("Unable to load dashboard metrics.")
        } finally {
          setIsLoading(false)
        }
      }
      loadMetrics()
    }, [])

    const metrics: MetricConfig[] = [
      { key: "population", label: "Student Population", color: "#E85002" },
      { key: "personnel", label: "Teaching Staff", color: "#18181b" },
    ]

    if (isLoading) {
      return (
        <div className="flex flex-col gap-4 p-2 md:p-1">
          <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm h-[320px] animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[155px] bg-white rounded-xl border border-zinc-200 p-4 shadow-sm animate-pulse" />
            ))}
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 h-[500px]">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => window.location.reload()} className="text-xs underline">Retry</button>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4 p-2 md:p-1">
      
        {/* Universal Interactive Chart View Engine */}
        <div className="w-full bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
          <UniversalBarChart 
            title="Overview"
            description="Institutional population metrics across student, faculty, and staff divisions."
            data={data}
            metrics={metrics}
            defaultMetricKey="population"
          />
        </div>
        
        {/* Visual Hierarchy Layout centered on the primary Orange accent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Slot 1: Stacked Layered Area Layout — Hero base orange overlapping with dark tracking text */}
          <UniversalAreaMiniChart
            title="Students vs Faculty"
            subtitle="Population mapped against teaching staff"
            data={data}
            dataKey="population"
            secondaryDataKey="personnel"
            color="#E85002"
            secondaryColor="#18181b"
            height={135}
          />

          {/* Slot 2: Secondary metric as a crisp, structural dark neutral */}
          <UniversalLineMiniChart
            title="Teaching Staff"
            subtitle="Total faculty headcount"
            data={data}
            dataKey="personnel"
            color="#18181b"
            height={135}
          />
          
          {/* Slot 3: Mini Bar Chart uses the clean core accent color */}
          <UniversalBarMiniChart
            title="Student Body"
            subtitle="Total enrolled student population"
            data={data}
            dataKey="population"
            color="#E85002"
            height={135}
          />
          
          {/* Slot 4: Muted slate-zinc distribution component so it blends elegantly into the background */}
          <UniversalBarMiniChart
            title="Support Staff"
            subtitle="Total administrative staff"
            data={data}
            dataKey="support"
            color="#18181b"
            height={135}
          />
        </div>

      </div>
    )
  }
