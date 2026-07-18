"use client"

import { useEffect, useState } from "react"
import { GraduationCap, Users, UserCog, ArrowRight } from "lucide-react"
import Link from "next/link"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

export default function DashboardPage() {
  const [kpis, setKpis] = useState({
    students: null as number | null,
    teachers: null as number | null,
    staff: null as number | null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchKpis() {
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

        setKpis({
          students: studentsData.total ?? studentsData.pagination?.total ?? null,
          teachers: teachersData.total ?? teachersData.pagination?.total ?? null,
          staff: staffData.total ?? staffData.pagination?.total ?? null,
        })
      } catch {
        setError("Unable to load dashboard metrics.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchKpis()
  }, [])

  const cards = [
    {
      label: "Total Students",
      value: kpis.students,
      icon: <GraduationCap className="h-5 w-5" />,
      href: "/students",
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    },
    {
      label: "Total Teachers",
      value: kpis.teachers,
      icon: <Users className="h-5 w-5" />,
      href: "/teachers",
      color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    },
    {
      label: "Total Staff",
      value: kpis.staff,
      icon: <UserCog className="h-5 w-5" />,
      href: "/staff",
      color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    },
  ]

  const quickActions = [
    { label: "Attendance", href: "/operations/attendance" },
    { label: "Gradebook", href: "/students/gradebook" },
    { label: "Finance", href: "/finance" },
    { label: "Timetable", href: "/operations" },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">School management overview</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-md border border-destructive/50 bg-destructive/5 text-sm text-destructive">
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="underline text-xs">Retry</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="group rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  {card.icon}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight">
                  {card.value !== null ? card.value.toLocaleString() : "\u2014"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-medium">Quick Actions</h2>
        <p className="text-sm text-muted-foreground mt-1">Common tasks and navigation</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {quickActions.map((link) => (
            <Link key={link.label} href={link.href} className="flex items-center justify-center h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
