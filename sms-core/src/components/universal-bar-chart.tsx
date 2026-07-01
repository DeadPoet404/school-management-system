"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from "recharts"

export interface ChartDataPoint {
  date: string
  [key: string]: any // Dynamic metrics tracking entries
}

export interface MetricConfig {
  key: string
  label: string
  color?: string
}

interface UniversalBarChartProps {
  title: string
  description?: string
  data: ChartDataPoint[]
  metrics: MetricConfig[] // Array tracking active data property keys
  defaultMetricKey?: string
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const dateStr = new Date(label).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    return (
      <div className="rounded-lg bg-white p-3 shadow-md text-xs border border-zinc-200">
        <p className="font-semibold mb-1 text-zinc-900">{dateStr}</p>
        {payload.map((item: any) => (
          <div key={item.name} className="flex items-center gap-2 mt-1">
            <span 
              className="w-2 h-2 rounded-full inline-block" 
              style={{ backgroundColor: item.fill || item.color }} 
            />
            <span className="text-zinc-500 capitalize">{item.name}:</span>
            <span className="font-bold text-zinc-900">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function UniversalBarChart({
  title,
  description,
  data,
  metrics,
  defaultMetricKey,
}: UniversalBarChartProps) {
  const [activeMetric, setActiveMetric] = React.useState<string>(
    defaultMetricKey || metrics[0]?.key || ""
  )

  const totals = React.useMemo(() => {
    const result: Record<string, number> = {}
    metrics.forEach((metric) => {
      result[metric.key] = data.reduce((acc, curr) => acc + (Number(curr[metric.key]) || 0), 0)
    })
    return result
  }, [data, metrics])

  const selectedMetricConfig = metrics.find((m) => m.key === activeMetric)
  const activeColor = selectedMetricConfig?.color || "#E85002"

  return (
    <div className="w-full select-none outline-none focus:outline-none">
      <div className="flex flex-col items-stretch p-0 outline-none sm:flex-row justify-between mb-4">
        <div className="flex flex-1 flex-col justify-center gap-1 px-4 pt-4 pb-3 sm:py-0">
          <div className="flex items-center gap-6">
            <h1 className="text-5xl tracking-tight text-zinc-900">{title}</h1>
          </div>
          {description && (
            <p className="text-sm text-zinc-500 mt-1">
              {description}
            </p>
          )}
        </div>
        
        <div className="flex outline-none border-b border-zinc-100 sm:border-b-0">
          {metrics.map((metric) => {
            const isSelected = activeMetric === metric.key
            return (
              <button
                key={metric.key}
                data-active={isSelected}
                className="relative z-30 flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-left outline-none focus:outline-none sm:px-8 sm:py-6 border-0 transition-all data-[active=true]:bg-zinc-50"
                onClick={() => setActiveMetric(metric.key)}
              >
                <span className="text-xs text-zinc-500 font-light">
                  {metric.label}
                </span>
                <span 
                  className="text-lg leading-none sm:text-3xl font-medium transition-colors"
                  style={{ color: isSelected ? activeColor : '#18181b' }}
                >
                  {(totals[metric.key] || 0).toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-2 sm:px-4 w-full h-[350px] [&_.recharts-wrapper]:outline-none [&_svg]:outline-none [&_.recharts-wrapper]:focus:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} stroke="#e4e4e7" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tick={{ fontSize: 10, fill: '#71717a' }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} content={<CustomTooltip />} />
            <Bar 
              dataKey={activeMetric} 
              fill={activeColor} 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
