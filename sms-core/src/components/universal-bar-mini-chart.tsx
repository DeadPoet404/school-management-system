"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from "recharts"

export interface MiniBarDataPoint {
  date: string
  [key: string]: any
}

interface UniversalBarMiniChartProps {
  title: string
  subtitle?: string
  data: MiniBarDataPoint[]
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
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.fill }} />
            <span className="font-semibold text-zinc-950">{Number(entry.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function UniversalBarMiniChart({
  title,
  subtitle,
  data,
  dataKey,
  secondaryDataKey,
  color = "#E85002",
  secondaryColor = "#18181b",
  height = 110,
}: UniversalBarMiniChartProps) {
  
  const latestTotal = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + (Number(curr[dataKey]) || 0), 0)
  }, [data, dataKey])

  return (
    <div className="w-full h-full flex flex-col justify-between bg-white p-4 rounded-xl border border-zinc-200 shadow-sm overflow-hidden select-none font-sans">
      <div className="flex flex-col mb-2">
        <span className="text-xs font-light text-zinc-400 tracking-wide uppercase">{title}</span>
        <span className="text-2xl font-semibold text-zinc-900 tracking-tight mt-0.5">{latestTotal.toLocaleString()}</span>
        {subtitle && <span className="text-[11px] text-zinc-400 font-light truncate mt-0.5">{subtitle}</span>}
      </div>

      <div style={{ width: "100%", height }} className="[&_.recharts-wrapper]:outline-none [&_svg]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} stroke="#e4e4e7" />
            <XAxis dataKey="date" hide />
            <Tooltip cursor={{ fill: 'transparent' }} content={<CompactTooltip />} />
            <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
            {secondaryDataKey && <Bar dataKey={secondaryDataKey} fill={secondaryColor} radius={[2, 2, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
