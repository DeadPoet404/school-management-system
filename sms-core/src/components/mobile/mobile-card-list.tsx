"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import {
  MobileDetailSheet,
  type MobileSheetRow,
} from "@/components/mobile/mobile-detail-sheet"

export interface MobileCardItem {
  id: string
  /** First line of the card — the record's name/primary identity. */
  primary: React.ReactNode
  /** Second line — id · class / email etc. */
  meta?: React.ReactNode
  /** Compact status/value pills rendered under the meta line. */
  chips?: React.ReactNode[]
  /** Optional right-aligned emphasised value (e.g. a balance/net pay). */
  trailing?: React.ReactNode
  sheetTitle: React.ReactNode
  sheetDescription?: React.ReactNode
  sheetRows: MobileSheetRow[]
  sheetFooter?: React.ReactNode
}

interface MobileCardListProps {
  rows: MobileCardItem[]
  emptyMessage?: string
}

/**
 * Generic mobile (below-lg) registry list. One card per row; tapping a card
 * opens the bottom-anchored detail sheet. Registry pages hand this a memoised
 * MobileCardItem[] so per-entity adapters stay tiny and the desktop table
 * (behind its own lg gate) is untouched.
 */
export function MobileCardList({
  rows,
  emptyMessage = "No records found.",
}: MobileCardListProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const selected = React.useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  )

  return (
    <>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center px-6 text-center text-xs text-zinc-400">
          {emptyMessage}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelectedId(row.id)}
                aria-label="View details"
                className="flex min-h-[64px] w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/40 dark:active:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {row.primary}
                  </div>

                  {row.meta ? (
                    <div className="mt-1 truncate font-mono text-xs tracking-wide text-zinc-400 dark:text-zinc-500">
                      {row.meta}
                    </div>
                  ) : null}

                  {row.chips && row.chips.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {row.chips.filter(Boolean).map((chip, index) => (
                        <React.Fragment key={index}>{chip}</React.Fragment>
                      ))}
                    </div>
                  ) : null}
                </div>

                {row.trailing ? (
                  <div className="shrink-0 text-right">{row.trailing}</div>
                ) : null}

                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <MobileDetailSheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        title={selected?.sheetTitle ?? ""}
        description={selected?.sheetDescription}
        rows={selected?.sheetRows ?? []}
        footer={selected?.sheetFooter}
      />
    </>
  )
}
