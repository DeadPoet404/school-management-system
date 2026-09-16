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
import { fetchWithAuth } from "@/lib/fetch-with-auth"

/**
 * Settings → Class List: generate a print-ready PDF roster for any class.
 * Active students only, sorted A–Z, on the official school letterhead
 * (same branding as the payment receipts).
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
    // Open the tab synchronously so mobile browsers do not block the PDF
    // after the request resolves (same pattern as receipt PDFs).
    const win = window.open("", "_blank")
    try {
      const response = await fetchWithAuth(
        `/students/class-list.pdf?classId=${encodeURIComponent(selected.id)}`,
      )
      if (!response.ok) throw new Error("Class list PDF request failed")
      const url = URL.createObjectURL(await response.blob())
      if (win) {
        win.opener = null
        win.location.href = url
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        URL.revokeObjectURL(url)
        toast.error("Your browser blocked the PDF window. Please allow pop-ups and try again.")
      }
    } catch (err) {
      win?.close()
      toast.error(err instanceof Error ? err.message : "Unable to generate the class list PDF.")
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
          students only, sorted A–Z. Opens in a new tab, ready to print or save.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={handleGenerate} loading={generating} disabled={!selected}>
            <Printer />
            Generate PDF
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
            ? "The PDF shows every active student currently placed in this class."
            : "Pick a class, then generate the PDF."}
        </p>
      </CardContent>
    </Card>
  )
}
