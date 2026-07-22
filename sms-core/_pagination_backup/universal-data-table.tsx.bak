"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface DataTableColumn<T = any> {
  key: string
  header: string
  className?: string     // For layout & structural classes (width, text alignment)
  cellClassName?: string // For cell typography/color specifics (font-mono, text-muted)
  cell?: (row: T) => React.ReactNode
}

interface PaginationData {
  page: number
  totalPages: number
  total: number
}

interface UniversalDataTableProps<T = any> {
  data: T[]
  columns: DataTableColumn<T>[]
  rowId: (row: T) => string
  emptyMessage?: string
  selectable?: boolean
  pagination?: PaginationData
  onPageChange?: (page: number) => void
}

export function UniversalDataTable<T>({
  data,
  columns,
  rowId,
  emptyMessage = "No records found.",
  selectable = true,
  pagination,
  onPageChange,
}: UniversalDataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const totalRows = data.length
  const selectAll = totalRows > 0 && selectedRows.size === totalRows

  const handleSelectAll = (checked: boolean) => {
    setSelectedRows(
      checked ? new Set(data.map((row) => rowId(row))) : new Set()
    )
  }

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedRows)
    if (checked) next.add(id)
    else next.delete(id)
    setSelectedRows(next)
  }

  return (
    <div className=" space-y-3">
      <div className="rounded-md border border-zinc-200 bg-card overflow-hidden  dark:border-zinc-800">
        <Table>
          <TableHeader className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
            <TableRow className="hover:bg-transparent border-b-0 whitespace-nowrap">
              {selectable && (
                <TableHead className="py-2.5 px-3 h-10 w-10 text-center border-r border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all rows"
                    />
                  </div>
                </TableHead>
              )}

              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={`py-2.5 px-3 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 last:border-r-0 dark:border-zinc-800 ${column.className || ""}`}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {totalRows === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-10 text-xs font-mono text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const id = rowId(row)

                return (
                  <TableRow
                    key={id}
                    data-state={selectedRows.has(id) ? "selected" : undefined}
                    className="hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 whitespace-nowrap transition-colors duration-150 ease-in-out"
                  >
                    {selectable && (
                      <TableCell className="py-2 px-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={selectedRows.has(id)}
                            onCheckedChange={(checked) =>
                              handleSelectRow(id, checked === true)
                            }
                          />
                        </div>
                      </TableCell>
                    )}

                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={`py-2 px-3 border-r border-zinc-200 last:border-r-0 dark:border-zinc-800 text-sm ${column.className || ""} ${column.cellClassName || ""}`}
                      >
                        {column.cell ? column.cell(row) : (row as any)[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground font-mono">
            Page {pagination.page} of {pagination.totalPages} — {pagination.total} records
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
