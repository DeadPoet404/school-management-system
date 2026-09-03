"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface MobilePagerProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * Compact previous/next pager for the mobile card lists that replace
 * server-paginated data tables below the lg breakpoint. Hidden when there
 * is only one page.
 */
export function MobilePager({
  page,
  totalPages,
  onPageChange,
}: MobilePagerProps) {
  if (totalPages <= 1) return null

  const clampedTotal = Math.max(totalPages, 1)
  const atStart = page <= 1
  const atEnd = page >= clampedTotal

  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-4 pb-2">
      <button
        type="button"
        disabled={atStart}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/50"
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </button>

      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Page {page} of {clampedTotal}
      </p>

      <button
        type="button"
        disabled={atEnd}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/50"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
