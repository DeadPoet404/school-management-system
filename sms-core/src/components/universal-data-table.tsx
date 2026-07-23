"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface DataTableColumn<T = any> {
  /** Column identifier used as React key; also used to look up a raw row value when `cell` is not provided. */
  key: string
  /** Column header label. */
  header: string
  /** Optional className applied to the <th>. */
  className?: string
  /** Optional className applied to every <td> in this column (when no custom renderer). */
  cellClassName?: string
  /** Optional custom cell renderer; receives the full row. */
  cell?: (row: T) => React.ReactNode
  /** Column alignment (convenience). */
  align?: "left" | "center" | "right"
}

export interface PaginationState {
  page?: number
  limit?: number
  totalItems?: number
  total?: number
  totalPages?: number
}

export interface UniversalDataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  /** Returns a stable row key (e.g. row => row.id). */
  rowId: (row: T) => string
  /** Message shown when `data` is empty. */
  emptyMessage?: string
  /** Optional className applied to the root wrapper. */
  className?: string
  /** Optional max height for scrollable body. */
  maxHeight?: string
  /** Pagination metadata from the backend envelope. */
  pagination?: PaginationState
  /** Called when user clicks a page number. If omitted, no pagination footer is rendered. */
  onPageChange?: (page: number) => void
  /** Compact rows (dense). */
  compact?: boolean
  /** Reserved for future row-selection support. Accepted for prop compatibility; currently a no-op. */
  selectable?: boolean
}

function renderCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number" || typeof value === "string") return value
  if (value instanceof Date) return value.toLocaleDateString()
  // For objects/arrays, stringify safely (prevents [object Object])
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function UniversalDataTable<T>({
  data,
  columns,
  rowId,
  emptyMessage = "No records found.",
  className,
  maxHeight,
  pagination,
  onPageChange,
  compact = false,
}: UniversalDataTableProps<T>) {
  const currentPage = Math.max(1, pagination?.page ?? 1)
  const totalItems = pagination?.totalItems ?? pagination?.total ?? data.length
  const limit = pagination?.limit ?? data.length
  const totalPages =
    pagination?.totalPages ?? (limit > 0 ? Math.ceil(totalItems / limit) : 1)

  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <div className={`w-full ${className ?? ""}`}>
      <div
        className="w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <Table>
          <TableHeader className="bg-zinc-50/80 dark:bg-zinc-900/50">
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`text-xs font-semibold uppercase tracking-tight text-zinc-600 dark:text-zinc-400 ${col.className ?? ""}`}
                  align={col.align}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={rowId(row)}
                  className={`hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 ${
                    compact ? "h-9" : ""
                  }`}
                >
                  {columns.map((col) => {
                    const raw = (row as Record<string, unknown>)[col.key]
                    const content = col.cell ? (col.cell as (r: T) => React.ReactNode)(row) : renderCellValue(raw)
                    return (
                      <TableCell
                        key={col.key}
                        className={`text-sm ${col.cellClassName ?? ""}`}
                        align={col.align}
                      >
                        {content}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Page {currentPage} of {totalPages} · {totalItems} record
            {totalItems === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canPrev}
              className="h-7 w-7 p-0"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canNext}
              className="h-7 w-7 p-0"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UniversalDataTable
