"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Download,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  Loader2,
  School,
  Users,
  Wallet,
  Bomb,
} from "lucide-react"
import {
  getDataSummary,
  getInstitution,
  wipeData,
  downloadCsvExport,
  CSV_EXPORTS,
  type DataSummary,
  type WipeScope,
} from "@/lib/api/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

// ── Wipe zone copy ───────────────────────────────────────────────────────────

const WIPES: Array<{
  scope: WipeScope
  title: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  rows: (s: DataSummary) => Array<{ label: string; count: number }>
}> = [
  {
    scope: "students",
    title: "Academic — students",
    icon: School,
    description:
      "Deletes every student with their accounts, guardians, attendance, grades, invoices, ledgers and payment history. Classes, subjects and terms are kept.",
    rows: (s) => [
      { label: "Students", count: s.students },
      { label: "Guardians", count: s.guardians },
      { label: "Attendance rows", count: s.attendanceRecords },
      { label: "Grade records", count: s.gradeRecords },
      { label: "Invoices", count: s.invoices },
      { label: "Payments", count: s.payments + s.paymentCollections + s.paymentIntents },
    ],
  },
  {
    scope: "personnel",
    title: "Academic — staff & teachers",
    icon: Users,
    description:
      "Deletes all staff and teacher records (accounts, payroll, departures) and their timetable allocations. Admin-role accounts are always kept so the school can still log in.",
    rows: (s) => [
      { label: "Teachers", count: s.teachers },
      { label: "Staff", count: s.staff },
      { label: "Payroll rows", count: s.payrollRows },
    ],
  },
  {
    scope: "financial",
    title: "Financial — fees, payments & payroll",
    icon: Wallet,
    description:
      "Deletes invoices, payments, collections, fee structures, tiers, components and expenses, and zeroes every student ledger balance. The chart of accounts itself is kept.",
    rows: (s) => [
      { label: "Invoices", count: s.invoices },
      { label: "Payments & collections", count: s.payments + s.paymentCollections + s.paymentIntents },
      { label: "Fee structures", count: s.feeStructures },
      { label: "Fee tiers / components", count: s.feeTiers + s.feeComponents },
      { label: "Expenses", count: s.expenses },
      { label: "Payroll rows", count: s.payrollRows },
    ],
  },
  {
    scope: "all",
    title: "Everything (full reset)",
    icon: Bomb,
    description:
      "Runs all three wipes above, plus announcements, notification deliveries and active sessions. Only the institution profile, class/subject/term structure, the chart of accounts, admin accounts and the audit trail survive.",
    rows: (s) => [
      { label: "Students", count: s.students },
      { label: "Teachers + staff", count: s.teachers + s.staff },
      { label: "Invoices", count: s.invoices },
      { label: "Payments & collections", count: s.payments + s.paymentCollections + s.paymentIntents },
      { label: "Expenses", count: s.expenses },
      { label: "Announcements", count: s.announcements },
    ],
  },
]

// ── Wipe card ────────────────────────────────────────────────────────────────

function WipeCard({
  config,
  summary,
  schoolCode,
}: {
  config: (typeof WIPES)[number]
  summary: DataSummary
  schoolCode: string
}) {
  const queryClient = useQueryClient()
  const [armed, setArmed] = React.useState(false)
  const [confirm, setConfirm] = React.useState("")

  const mutation = useMutation({
    mutationFn: () => wipeData(config.scope, confirm),
    onSuccess: (result) => {
      setArmed(false)
      setConfirm("")
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      toast.success(`Wiped: ${config.title}`, {
        description: result.message,
      })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "The wipe was rejected."
      toast.error("Wipe blocked", { description: message })
    },
  })

  const rows = summary ? config.rows(summary) : []
  const total = rows.reduce((n, r) => n + r.count, 0)
  const isBusy = mutation.isPending
  const matches = confirm.trim() === schoolCode
  const Icon = config.icon
  const isAll = config.scope === "all"

  return (
    <Card className={isAll ? "border-red-300 dark:border-red-900" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className={`h-4 w-4 ${isAll ? "text-red-600 dark:text-red-400" : ""}`} />
          {config.title}
        </CardTitle>
        <CardDescription className="line-clamp-none text-xs">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((row) => (
                <Badge key={row.label} variant="secondary" className="font-mono text-[11px]">
                  {row.label}: {row.count.toLocaleString()}
                </Badge>
              ))}
              <Badge variant={total > 0 ? "default" : "secondary"} className="ml-auto font-mono text-[11px]">
                {total.toLocaleString()} rows total
              </Badge>
            </div>
            <Separator />
          </>
        )}

        {!armed ? (
          <Button
            variant={isAll ? "destructive" : "outline"}
            size="sm"
            className="w-full justify-center sm:w-auto"
            disabled={isBusy || !summary}
            onClick={() => setArmed(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Wipe {config.scope === "all" ? "everything" : config.title.split("— ")[1]?.toLowerCase() ?? config.scope}
          </Button>
        ) : (
          <div className="space-y-2.5 rounded-lg border border-red-300 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="flex items-start gap-2 text-xs font-medium text-red-700 dark:text-red-300">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This cannot be undone and affects {total.toLocaleString()} rows. Type{" "}
              <span className="font-mono font-bold">{schoolCode}</span> to confirm.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={`Type ${schoolCode}`}
                className="h-9 flex-1 font-mono"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!matches || isBusy}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Confirm wipe
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => {
                    setArmed(false)
                    setConfirm("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function DataPanel() {
  const [exporting, setExporting] = React.useState<string | null>(null)

  const { data: summary, isPending, refetch } = useQuery({
    queryKey: ["settings", "data-summary"],
    queryFn: getDataSummary,
  })

  const { data: institution } = useQuery({
    queryKey: ["settings", "institution"],
    queryFn: getInstitution,
  })

  const handleExport = async (id: string) => {
    const item = CSV_EXPORTS.find((e) => e.id === id)
    if (!item || exporting) return
    setExporting(id)
    try {
      await downloadCsvExport(item.path, item.filename)
      toast.success("Export ready", { description: `${item.filename} downloaded.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed."
      toast.error("Export failed", { description: message })
    } finally {
      setExporting(null)
    }
  }

  const overview: Array<{ label: string; value: number }> = summary
    ? [
        { label: "Students", value: summary.students },
        { label: "Guardians", value: summary.guardians },
        { label: "Teachers", value: summary.teachers },
        { label: "Staff", value: summary.staff },
        { label: "Classes", value: summary.classes },
        { label: "Subjects", value: summary.subjects },
        { label: "Terms", value: summary.terms },
        { label: "Invoices", value: summary.invoices },
        { label: "Payments", value: summary.payments + summary.paymentCollections + summary.paymentIntents },
        { label: "Expenses", value: summary.expenses },
        { label: "Announcements", value: summary.announcements },
      ]
    : []

  return (
    <div className="space-y-4">
      {/* Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">What&apos;s in the database</CardTitle>
          <CardDescription>Live row counts across every zone.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {overview.map((item) => (
                  <div key={item.label} className="rounded-lg border bg-muted/30 p-2.5">
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="font-mono text-lg font-semibold leading-tight">
                      {item.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh counts
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" /> Export (CSV)
          </CardTitle>
          <CardDescription>
            Full lists, not just the current page. Re-import them after a wipe with the import
            tools on each module page.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {CSV_EXPORTS.map((item) => (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={exporting !== null}
                onClick={() => handleExport(item.id)}
              >
                {exporting === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" /> Import (CSV)
          </CardTitle>
          <CardDescription>
            Uploads are validated row by row — bad rows are reported with the exact row and field,
            good rows are saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button asChild variant="outline" size="sm" className="justify-start gap-2">
              <Link href="/students">
                <Upload className="h-3.5 w-3.5" /> Import students
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start gap-2">
              <Link href="/teachers">
                <Upload className="h-3.5 w-3.5" /> Import teachers
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start gap-2">
              <Link href="/staff">
                <Upload className="h-3.5 w-3.5" /> Import staff
              </Link>
            </Button>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">
            Tip: export first, keep a local copy of the CSV, then wipe and re-import to migrate
            data between terms or between environments.
          </p>
        </CardContent>
      </Card>

      {/* Wipes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
              Reset zones (type the school code to confirm)
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each wipe runs in a single database transaction and is written to the audit log.
              School structure (classes, subjects, terms) and admin accounts always survive.
            </p>
          </div>
        </div>
        {summary ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {WIPES.map((config) => (
              <WipeCard
                key={config.scope}
                config={config}
                summary={summary}
                schoolCode={institution?.schoolCode ?? ""}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
