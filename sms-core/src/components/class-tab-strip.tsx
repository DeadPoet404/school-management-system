"use client"

import * as React from "react"
import { Check, ChevronDown, Layers, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

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
 * Splits the class ladder at its natural pre-primary/primary boundary rather
 * than the midpoint, so a stage is never cut across two rows.
 */
function useClassTiers(sections: ClassTabOption[]) {
  return React.useMemo(() => {
    // First class that belongs to primary or above starts the second row.
    const boundary = sections.findIndex((s) => /^(grade|primary|jhs|j\.h\.s|basic)/i.test(s.label.trim()))
    const cut = boundary > 0 ? boundary : Math.ceil(sections.length / 2)
    return [sections.slice(0, cut), sections.slice(cut)] as const
  }, [sections])
}

/**
 * Tablet/desktop rendition: two rows of inline pills.
 *
 * Each row scrolls horizontally on its own and buttons size to their text
 * (no flex-1, no truncate), so long names like "Pre-School (Crèche)" stay
 * readable. Only rendered from md up — below that the rows overflow a phone
 * and most classes sit off-screen with no affordance.
 */
function ClassTabRows({
  sections,
  activeSection,
  onSelect,
  label,
}: Required<Pick<ClassTabStripProps, "sections" | "activeSection" | "onSelect" | "label">>) {
  const [lowerTier, upperTier] = useClassTiers(sections)

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
    <div className="flex w-full flex-col gap-2.5">
      {lowerTier.length > 0 && renderRow(lowerTier, 0)}
      {upperTier.length > 0 && renderRow(upperTier, 1)}
    </div>
  )
}

/**
 * Phone rendition: one full-width trigger + a searchable bottom sheet.
 *
 * A vertical list is the native pattern for "pick one of many" on a phone —
 * it fits every class name without truncation, is searchable (schools run
 * 20+ sections), and always shows the current selection in a single line.
 */
function ClassPickerField({
  sections,
  activeSection,
  onSelect,
  label,
}: Required<Pick<ClassTabStripProps, "sections" | "activeSection" | "onSelect" | "label">>) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const active = React.useMemo(
    () => sections.find((section) => section.id === activeSection) ?? null,
    [sections, activeSection]
  )

  const filtered = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return sections
    return sections.filter(
      (section) =>
        section.label.toLowerCase().includes(normalizedQuery) ||
        section.id.toLowerCase().includes(normalizedQuery)
    )
  }, [sections, query])

  function close() {
    setOpen(false)
    setQuery("")
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-stone-200/60 bg-stone-100 px-3 text-left transition-colors active:bg-stone-200/70 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:active:bg-zinc-800"
      >
        <span
          className={cn(
            "truncate text-sm",
            active
              ? "font-semibold text-stone-900 dark:text-zinc-50"
              : "font-medium text-stone-500 dark:text-zinc-400"
          )}
        >
          {active?.label ?? `Choose ${label.toLowerCase()}`}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 dark:text-zinc-500" />
      </button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true)
          else close()
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] w-full overflow-hidden rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {/* Grabber */}
          <div
            aria-hidden
            className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700"
          />

          <SheetHeader className="shrink-0 border-b border-zinc-100 pb-3 pr-8 dark:border-zinc-800">
            <SheetTitle>{label}</SheetTitle>
            <SheetDescription>
              {sections.length} {sections.length === 1 ? "class" : "classes"} available
            </SheetDescription>
          </SheetHeader>

          <div className="shrink-0 px-4 pt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search classes..."
                aria-label="Search classes"
                inputMode="search"
                autoComplete="off"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-400">
                No classes match “{query.trim()}”.
              </p>
            ) : (
              <div role="listbox" aria-label={label} className="pb-2">
                {filtered.map((section) => {
                  const selected = section.id === activeSection

                  return (
                    <button
                      key={section.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onSelect(section.id)
                        close()
                      }}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        selected
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : "active:bg-zinc-100 dark:active:bg-zinc-800"
                      )}
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          selected
                            ? "font-semibold text-zinc-900 dark:text-zinc-50"
                            : "font-medium text-zinc-800 dark:text-zinc-100"
                        )}
                      >
                        {section.label}
                      </span>

                      {selected ? (
                        <Check className="h-4 w-4 shrink-0 text-zinc-900 dark:text-zinc-50" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

/**
 * Class selector shared by collections, fee structuring and timetable
 * scheduling so the three screens stay visually identical.
 */
export function ClassTabStrip({
  sections,
  activeSection,
  onSelect,
  label = "Select Class",
  className,
}: ClassTabStripProps) {
  return (
    <div className={cn("mt-3 flex shrink-0 flex-col gap-1.5 sm:mt-5", className)}>
      <Label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">
        <Layers className="h-3 w-3" /> {label}
      </Label>

      {/* ── Phones: single tap target + searchable sheet (no h-scroll) ── */}
      <div className="md:hidden">
        <ClassPickerField
          sections={sections}
          activeSection={activeSection}
          onSelect={onSelect}
          label={label}
        />
      </div>

      {/* ── Tablet and up: the inline strip still fits ── */}
      <div className="hidden md:block">
        <ClassTabRows
          sections={sections}
          activeSection={activeSection}
          onSelect={onSelect}
          label={label}
        />
      </div>
    </div>
  )
}
