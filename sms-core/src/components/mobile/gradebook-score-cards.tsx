"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export interface GradebookCardRow {
  studentId: string
  studentName: string
  rollNumber: string
  classScore: string
  examScore: string
  total: string
  grade: React.ReactNode
  remark?: string
}

export type GradebookScoreField = "classScore" | "examScore"

interface GradebookScoreCardsProps {
  rows: GradebookCardRow[]
  onScoreChange: (studentId: string, field: GradebookScoreField, value: string) => void
  emptyMessage?: string
  maxClassScore?: number
  maxExamScore?: number
  /** Disables entry until class, subject and term are all chosen. */
  locked?: boolean
}

interface ScoreFieldProps {
  id: string
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

function ScoreField({ id, label, value, disabled, onChange }: ScoreFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
      >
        {label}
      </label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={value}
        placeholder="0.0"
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-10 text-center text-sm font-semibold tabular-nums",
          "bg-amber-50/10 dark:bg-amber-950/5"
        )}
      />
    </div>
  )
}

/**
 * Phone rendition of the continuous assessment sheet.
 *
 * The desktop grid is seven columns wide, which on a phone forces a
 * horizontal scroll just to reach the Exam mark. Each card keeps the two
 * editable fields side by side (they fit at 320px), shows the live
 * total/grade on the same line as the name, and leaves the rest of the
 * width for the student's name instead of a truncated table cell.
 */
export function GradebookScoreCards({
  rows,
  onScoreChange,
  emptyMessage = "No students found.",
  maxClassScore = 30,
  maxExamScore = 70,
  locked = false,
}: GradebookScoreCardsProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center px-6 text-center text-xs text-zinc-400">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
      {rows.map((row) => (
        <li key={row.studentId} className="px-1 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                {row.studentName}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-zinc-400 dark:text-zinc-500">
                {row.rollNumber}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                {row.total}
              </p>
              <p className="text-[11px] leading-tight">{row.grade}</p>
              {row.remark ? (
                <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {row.remark}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <ScoreField
              id={`class-score-${row.studentId}`}
              label={`Class (${maxClassScore})`}
              value={row.classScore}
              disabled={locked}
              onChange={(value) => onScoreChange(row.studentId, "classScore", value)}
            />
            <ScoreField
              id={`exam-score-${row.studentId}`}
              label={`Exam (${maxExamScore})`}
              value={row.examScore}
              disabled={locked}
              onChange={(value) => onScoreChange(row.studentId, "examScore", value)}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
