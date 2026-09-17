"use client"

import * as React from "react"
import { Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useClasses } from "@/lib/api/reference"
import { printClassListInPage } from "@/lib/print-class-list"

// 2026-09: selectable print columns. Mirrors the backend catalog
// (class-list-print.ts) — keep in sync. Student NAME is always printed and
// not selectable; at most MAX_COLUMNS of these may be chosen so the A4
// table never gets crammed.
const COLUMN_OPTIONS: { key: string; label: string }[] = [
  { key: "studentId", label: "Student ID" },
  { key: "gender", label: "Gender" },
  { key: "dob", label: "Date of Birth" },
  { key: "guardian", label: "Guardian" },
  { key: "guardianPhone", label: "Guardian Phone" },
  { key: "feesOwed", label: "Fees Owed" },
]
const MAX_COLUMNS = 5

/**
 * Settings → Class List: print the roster of any class. Active students
 * only, sorted A–Z, on the official school letterhead (same branding as
 * the payment receipts). Opens the browser's native print dialog.
 */
export default function ClassListPanel() {
  const { data: classes, isLoading } = useClasses()
  const [classId, setClassId] = React.useState("")
  const [generating, setGenerating] = React.useState(false)
  // Default matches the historical print layout (Student ID + Gender).
  const [columns, setColumns] = React.useState<string[]>(["studentId", "gender"])

  const activeClasses = React.useMemo(
    () =>
      (classes ?? [])
        .filter((c) => c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  )

  const selected = activeClasses.find((c) => c.id === classId) ?? null
  const atLimit = columns.length >= MAX_COLUMNS

  function toggleColumn(key: string) {
    setColumns((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_COLUMNS
          ? prev
          : [...prev, key],
    )
  }

  async function handleGenerate() {
    if (!selected) return
    setGenerating(true)
    try {
      // Loads the print-ready page into a hidden iframe; its script opens
      // the browser's native print dialog (same flow as receipt printing).
      await printClassListInPage(selected.id, columns)
      toast.success("Class list ready — the print dialog is opening.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to print the class list.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card className="animate-fade-rise">
      <CardHeader>
        <CardTitle>Class List PDF</CardTitle>
        <CardDescription>
          Print-ready roster of a class — official school letterhead, active
          students only, sorted A–Z. Pick which columns to show, then open
          the browser&apos;s print dialog.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={handleGenerate} loading={generating} disabled={!selected}>
            <Printer />
            Print Class List
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="class-list-class" className="text-xs font-medium text-muted-foreground">
            Class
          </Label>
          {isLoading ? (
            <Skeleton className="h-9 w-full max-w-sm" />
          ) : (
            <select
              id="class-list-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-9 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select a class…</option>
              {activeClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">
              Columns to print <span className="text-muted-foreground/70">(Student Name is always included)</span>
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {columns.length}/{MAX_COLUMNS}
            </span>
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {COLUMN_OPTIONS.map((opt) => {
              const checked = columns.includes(opt.key)
              const disabled = !checked && atLimit
              return (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-center gap-2 text-xs ${
                    disabled ? "cursor-not-allowed opacity-40" : "text-foreground"
                  }`}
                  title={disabled ? `Maximum of ${MAX_COLUMNS} columns` : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleColumn(opt.key)}
                    className="h-3.5 w-3.5 accent-[#082a70]"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {selected
              ? "The list shows every active student currently placed in this class."
              : "Pick a class, then generate the list."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
