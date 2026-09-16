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

/**
 * Settings → Class List: print the roster of any class. Active students
 * only, sorted A–Z, on the official school letterhead (same branding as
 * the payment receipts). Opens the browser's native print dialog.
 */
export default function ClassListPanel() {
  const { data: classes, isLoading } = useClasses()
  const [classId, setClassId] = React.useState("")
  const [generating, setGenerating] = React.useState(false)

  const activeClasses = React.useMemo(
    () =>
      (classes ?? [])
        .filter((c) => c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [classes]
  )

  const selected = activeClasses.find((c) => c.id === classId) ?? null

  async function handleGenerate() {
    if (!selected) return
    setGenerating(true)
    try {
      // Loads the print-ready page into a hidden iframe; its script opens
      // the browser's native print dialog (same flow as receipt printing).
      await printClassListInPage(selected.id)
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
          students only, sorted A–Z. Opens the browser&apos;s print dialog,
          ready to print or save as PDF.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={handleGenerate} loading={generating} disabled={!selected}>
            <Printer />
            Print Class List
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
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
        <p className="text-xs text-muted-foreground">
          {selected
            ? "The list shows every active student currently placed in this class."
            : "Pick a class, then generate the PDF."}
        </p>
      </CardContent>
    </Card>
  )
}
