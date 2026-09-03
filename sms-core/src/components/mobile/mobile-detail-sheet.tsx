"use client"

import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export interface MobileSheetRow {
  label: string
  value?: React.ReactNode
}

interface MobileDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Primary heading shown at the top of the sheet. */
  title: React.ReactNode
  /** Optional one-line subtitle (e.g. "ID · Class"). */
  description?: React.ReactNode
  /** Label/value pairs rendered as a vertical definition list. */
  rows: MobileSheetRow[]
  /** Optional action area pinned under the scrollable body. */
  footer?: React.ReactNode
}

/**
 * Bottom-anchored detail sheet used by the mobile registry card lists.
 *
 * Follows the mobile app-interface rules in the design system:
 * - explicit close affordances (default X plus a Done action in the footer)
 * - scroll confined to the middle region (body never scrolls behind it)
 * - grabber affordance so users recognise it can be dismissed
 */
export function MobileDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  rows,
  footer,
}: MobileDetailSheetProps) {
  const visibleRows = rows.filter(
    (row) =>
      row.value !== undefined &&
      row.value !== null &&
      row.value !== "" &&
      row.value !== "—"
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] w-full overflow-hidden rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {/* Grabber */}
        <div
          aria-hidden
          className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700"
        />

        <SheetHeader className="shrink-0 border-b border-zinc-100 pb-3 pr-8 dark:border-zinc-800">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {visibleRows.length > 0 ? (
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {visibleRows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-1 py-3"
                >
                  <dt className="text-[10px] font-bold tracking-[0.16em] text-zinc-400 uppercase dark:text-zinc-500">
                    {row.label}
                  </dt>
                  <dd className="text-sm font-medium break-words text-zinc-900 dark:text-zinc-100">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="py-10 text-center text-xs text-zinc-400">
              No additional details available.
            </p>
          )}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-zinc-100 px-4 pt-3 dark:border-zinc-800">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
