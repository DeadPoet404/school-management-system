"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from "recharts"

export interface MiniLineDataPoint {
  date: string
  [key: string]: any
}

interface UniversalLineMiniChartProps {
  title: string
  subtitle?: string
  data: MiniLineDataPoint[]
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

export function UniversalLineMiniChart({
  title,
  subtitle,
  data,
  dataKey,
  secondaryDataKey,
  color = "#2563eb",
  secondaryColor = "#a1a1aa",
  height = 110,
}: UniversalLineMiniChartProps) {
  
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
          <LineChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} stroke="#e4e4e7" />
            <XAxis dataKey="date" hide />
            <Tooltip cursor={false} content={<CompactTooltip />} />
            
            {/* Primary Line */}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />

            {/* Optional Secondary Line */}
            {secondaryDataKey && (
              <Line
                type="monotone"
                dataKey={secondaryDataKey}
                stroke={secondaryColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}