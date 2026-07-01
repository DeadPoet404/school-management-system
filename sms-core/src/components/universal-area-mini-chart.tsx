"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from "recharts"

export interface MiniChartDataPoint {
  date: string
  [key: string]: any
}

interface UniversalAreaMiniChartProps {
  title: string
  subtitle?: string
  data: MiniChartDataPoint[]
  dataKey: string
  secondaryDataKey?: string
  color?: string
  secondaryColor?: string
  height?: number
}

function CompactTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md bg-white p-2 shadow-sm text-xs border border-zinc-100 font-sans flex flex-col gap-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.stroke }} />
            <span className="font-semibold text-zinc-950">
              {Number(entry.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function UniversalAreaMiniChart({
  title,
  subtitle,
  data,
  dataKey,
  secondaryDataKey,
  color = "#E85002",
  secondaryColor = "#a1a1aa",
  height = 110,
}: UniversalAreaMiniChartProps) {
  const uniqueId = React.useId()
  const gradientIdPrimary = `grad-p-${dataKey}-${uniqueId.replace(/:/g, "")}`
  const gradientIdSecondary = `grad-s-${secondaryDataKey}-${uniqueId.replace(/:/g, "")}`

  const latestTotal = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + (Number(curr[dataKey]) || 0), 0)
  }, [data, dataKey])

  return (
    <div className="w-full h-full flex flex-col justify-between bg-white p-4 rounded-xl border border-zinc-200 shadow-sm overflow-hidden select-none font-sans">
      
      <div className="flex flex-col mb-2">
        <span className="text-xs font-light text-zinc-400 tracking-wide uppercase">
          {title}
        </span>
        <span className="text-2xl font-semibold text-zinc-900 tracking-tight mt-0.5">
          {latestTotal.toLocaleString()}
        </span>
        {subtitle && (
          <span className="text-[11px] text-zinc-400 font-light truncate mt-0.5">
            {subtitle}
          </span>
        )}
      </div>

      <div style={{ width: "100%", height }} className="[&_.recharts-wrapper]:outline-none [&_svg]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientIdPrimary} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
              {secondaryDataKey && (
                <linearGradient id={gradientIdSecondary} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={secondaryColor} stopOpacity={0.01} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} stroke="#e4e4e7" />
            <XAxis dataKey="date" hide />
            <Tooltip cursor={false} content={<CompactTooltip />} />
            
            {secondaryDataKey && (
              <Area
                type="monotone"
                dataKey={secondaryDataKey}
                stroke={secondaryColor}
                strokeWidth={1.5}
                fill={`url(#${gradientIdSecondary})`}
                stackId="stack-zone"
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientIdPrimary})`}
              stackId="stack-zone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
