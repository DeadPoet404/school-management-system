"use client"

import * as React from "react"
import { useState, useRef } from "react"
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

export interface DataGridColumn<T = any> {
  key: string
  header: string
  className?: string     // For layout & structural classes (width, text alignment)
  cellClassName?: string // For cell typography/color specifics (font-mono, text-muted)
  editable?: boolean     // Flag indicating cell accepts manual data entry overrides
  placeholder?: string   // Fallback layout token string
}

interface PaginationData {
  page: number
  totalPages: number
  total: number
}

interface UniversalEditableGridProps<T = any> {
  data: T[]
  columns: DataGridColumn<T>[]
  rowId: (row: T) => string
  emptyMessage?: string
  selectable?: boolean
  pagination?: PaginationData
  onPageChange?: (page: number) => void
  onCellValueChange?: (rowId: string, columnKey: string, newValue: string) => void
}

export function UniversalEditableGrid<T>({
  data,
  columns,
  rowId,
  emptyMessage = "No records found.",
  selectable = true,
  pagination,
  onPageChange,
  onCellValueChange,
}: UniversalEditableGridProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const gridContainerRef = useRef<HTMLDivElement>(null)

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

  // --- EXCEL KEYBOARD NAVIGATION INTERCEPTOR MATRIX ---
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (!gridContainerRef.current) return

    const cellInputs = Array.from(
      gridContainerRef.current.querySelectorAll("input[data-grid-cell='true']")
    ) as HTMLInputElement[]

    const totalEditableCols = columns.filter(c => c.editable).length
    if (totalEditableCols === 0) return

    const currentInputIdx = cellInputs.findIndex(
      (input) =>
        Number(input.getAttribute("data-row")) === rowIndex &&
        Number(input.getAttribute("data-col")) === colIndex
    )

    if (currentInputIdx === -1) return

    let targetIdx = -1

    switch (e.key) {
      case "ArrowDown":
      case "Enter":
        e.preventDefault() 
        targetIdx = currentInputIdx + totalEditableCols
        break
      case "ArrowUp":
        e.preventDefault()
        targetIdx = currentInputIdx - totalEditableCols
        break
      case "ArrowRight":
        if (e.currentTarget.selectionEnd === e.currentTarget.value.length) {
          targetIdx = currentInputIdx + 1
        }
        break
      case "ArrowLeft":
        if (e.currentTarget.selectionStart === 0) {
          targetIdx = currentInputIdx - 1
        }
        break
      default:
        return
    }

    if (targetIdx >= 0 && targetIdx < cellInputs.length) {
      cellInputs[targetIdx].focus()
      cellInputs[targetIdx].select() 
    }
  }

  let editableColCount = 0

  return (
    /* Fix 1: Parent shell takes full heights and avoids breaking parent page configurations */
    <div className="w-full h-full flex flex-col min-h-0 space-y-3" ref={gridContainerRef}>
      
      {/* Fix 2: Container acts as a rigid block preventing layout expansion */}
      <div className="flex-1 min-h-0 rounded-md border border-zinc-200 bg-card overflow-hidden dark:border-zinc-800 flex flex-col">
        
        {/* Fix 3: Scrollable context window isolated completely to the table structure */}
        <div className="flex-1 overflow-y-auto min-h-0 relative">
          <Table>
            {/* Fix 4: Sticky header layout configuration pinning elements on the Y axis */}
            <TableHeader className="bg-zinc-50 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] backdrop-blur-xs">
              <TableRow className="hover:bg-transparent border-b-0 whitespace-nowrap">
                {selectable && (
                  <TableHead className="py-2.5 px-3 h-10 w-10 text-center border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
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
                    className={`py-2.5 px-3 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 last:border-r-0 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 ${column.className || ""}`}
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
                data.map((row, rowIndex) => {
                  const id = rowId(row)
                  editableColCount = 0 

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

                      {columns.map((column) => {
                        const isEditable = column.editable === true
                        const currentColIdx = editableColCount

                        if (isEditable) {
                          editableColCount++
                        }

                        return (
                          <TableCell
                            key={column.key}
                            className={`py-2 px-3 border-r border-zinc-200 last:border-r-0 dark:border-zinc-800 text-sm ${isEditable ? "p-0.5 focus-within:bg-zinc-50 dark:focus-within:bg-zinc-900/40" : ""} ${column.className || ""} ${column.cellClassName || ""}`}
                          >
                            {isEditable ? (
                              <input
                                data-grid-cell="true"
                                data-row={rowIndex}
                                data-col={currentColIdx}
                                type="text"
                                value={(row as any)[column.key] ?? ""}
                                placeholder={column.placeholder || "- -"}
                                onChange={(e) => onCellValueChange?.(id, column.key, e.target.value)}
                                onKeyDown={(e) => handleGridKeyDown(e, rowIndex, currentColIdx)}
                                className="w-full h-8 px-2.5 bg-transparent outline-none focus:bg-background font-mono text-xs focus:ring-1 focus:ring-zinc-400 rounded-sm transition-all tracking-tight text-center"
                              />
                            ) : (
                              (row as any)[column.key]
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination sits securely pinned outside scroll contexts */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-1 shrink-0">
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