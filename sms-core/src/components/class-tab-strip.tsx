"use client"

import * as React from "react"
import { Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

export interface ClassTabOption {
  id: string
  label: string
}

interface ClassTabStripProps {
  sections: ClassTabOption[]
  activeSection: string
  onSelect: (id: string) => void
  label?: string
  className?: string
}

/**
 * Two-row class selector shared by collections, fee structuring and
 * timetable scheduling so the three screens stay visually identical.
 *
 * Each row scrolls horizontally on its own and buttons size to their text
 * (no flex-1, no truncate), so long names like "Pre-School (Crèche)" are
 * always readable instead of being squeezed into "Pre-Sch…".
 *
 * The split point is the ladder's natural pre-primary/primary boundary
 * rather than the midpoint, so a stage is never cut across two rows.
 */
export function ClassTabStrip({
  sections,
  activeSection,
  onSelect,
  label = "Select Class",
  className,
}: ClassTabStripProps) {
  const [lowerTier, upperTier] = React.useMemo(() => {
    // First class that belongs to primary or above starts the second row.
    const boundary = sections.findIndex((s) => /^(grade|primary|jhs|j\.h\.s|basic)/i.test(s.label.trim()))
    const cut = boundary > 0 ? boundary : Math.ceil(sections.length / 2)
    return [sections.slice(0, cut), sections.slice(cut)]
  }, [sections])

  const rowRefs = React.useRef<Array<HTMLDivElement | null>>([])

  // Keep the selected class visible: with 27 classes a row overflows, and a
  // tab restored from state can sit off-screen. Scrolls the row only.
  React.useEffect(() => {
    if (!activeSection) return
    for (const row of rowRefs.current) {
      if (!row) continue
      const el = row.querySelector<HTMLButtonElement>(
        `[data-section-id="${CSS.escape(activeSection)}"]`
      )
      if (!el) continue
      const left = el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2
      row.scrollTo({ left: Math.max(0, left), behavior: "smooth" })
      break
    }
  }, [activeSection, sections])

  const renderRow = (rowSections: ClassTabOption[], rowIndex: number) => (
    <div
      ref={(node) => {
        rowRefs.current[rowIndex] = node
      }}
      role="tablist"
      aria-label={`${label} row ${rowIndex + 1}`}
      className="w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin] rounded-lg border border-stone-200/40 bg-stone-100 p-1.5 dark:border-zinc-800/40 dark:bg-zinc-900/50"
    >
      <div className="flex w-max items-center">
        {rowSections.map((section, idx) => (
          <React.Fragment key={section.id}>
            <button
              type="button"
              role="tab"
              data-section-id={section.id}
              aria-selected={activeSection === section.id}
              onClick={() => onSelect(section.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded px-3 py-1 text-center text-[11px] font-medium tracking-tight transition-all",
                activeSection === section.id
                  ? "border border-stone-200/20 bg-white font-semibold text-stone-900 shadow-sm dark:border-zinc-700/30 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-stone-500 hover:bg-stone-50/60 hover:text-stone-800 dark:text-zinc-400 dark:hover:bg-zinc-900/20 dark:hover:text-zinc-200"
              )}
            >
              {section.label}
            </button>
            {idx < rowSections.length - 1 && (
              <div className="mx-0.5 h-3 w-[1px] shrink-0 bg-stone-300 dark:bg-zinc-700" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )

  return (
    <div className={cn("mt-5 flex shrink-0 flex-col gap-1.5", className)}>
      <Label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">
        <Layers className="h-3 w-3" /> {label}
      </Label>

      <div className="flex w-full flex-col gap-2.5">
        {lowerTier.length > 0 && renderRow(lowerTier, 0)}
        {upperTier.length > 0 && renderRow(upperTier, 1)}
      </div>
    </div>
  )
}
