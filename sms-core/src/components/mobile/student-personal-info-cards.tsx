"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import type { StudentPersonalInfoRow } from "@/components/student-personal-info-table"
import {
  MobileDetailSheet,
  type MobileSheetRow,
} from "@/components/mobile/mobile-detail-sheet"

interface StudentPersonalInfoCardsProps {
  rows: StudentPersonalInfoRow[]
}

const genderChipClass = (gender: string) =>
  gender === "Male"
    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
    : gender === "Female"
      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"

/**
 * Mobile (below lg) rendering of the student personal-info registry.
 * Reuses the desktop-normalised rows — no logic duplication. Tapping a
 * card opens a bottom sheet with contact + demographic details.
 */
export function StudentPersonalInfoCards({
  rows,
}: StudentPersonalInfoCardsProps) {
  const { user } = useAuth()
  const canWrite = user?.role === "ADMIN" || user?.role === "STAFF"
  const [selected, setSelected] =
    React.useState<StudentPersonalInfoRow | null>(null)

  const detailRows: MobileSheetRow[] = selected
    ? [
        { label: "Student ID", value: selected.id },
        {
          label: "Institutional Email",
          value:
            selected.email !== "—" ? (
              <a
                href={`mailto:${selected.email}`}
                className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 break-all dark:text-blue-400"
              >
                {selected.email}
              </a>
            ) : (
              "—"
            ),
        },
        {
          label: "Mobile Number",
          value:
            selected.phone !== "—" ? (
              <a
                href={`tel:${selected.phone.replace(/[^+\d]/g, "")}`}
                className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
              >
                {selected.phone}
              </a>
            ) : (
              "—"
            ),
        },
        { label: "Date of Birth", value: selected.dateOfBirth },
        { label: "Gender", value: selected.gender },
        { label: "Blood Group", value: selected.bloodType },
        { label: "Religion", value: selected.religion },
        { label: "Primary Address", value: selected.address },
        { label: "Prior Education", value: selected.formerSchool },
        { label: "National ID / Ghana Card", value: selected.ghanaCard },
        {
          label: "Emergency Contact",
          value:
            selected.emergencyContact !== "—" ? (
              <a
                href={`tel:${selected.emergencyContact.replace(/[^+\d]/g, "")}`}
                className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
              >
                {selected.emergencyContact}
              </a>
            ) : (
              "—"
            ),
        },
      ]
    : []

  return (
    <>
      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center px-6 text-center text-xs text-zinc-400">
          No student records found.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {rows.map((row, index) => (
            <li key={`${row.id}-${index}`}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="flex min-h-[64px] w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/40 dark:active:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {row.studentMeta}
                    </p>
                  </div>

                  <p className="mt-1 truncate font-mono text-xs tracking-wide text-zinc-400 dark:text-zinc-500">
                    {row.id}
                    {row.email !== "—" ? ` · ${row.email}` : ""}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {row.gender !== "—" ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                          genderChipClass(row.gender)
                        )}
                      >
                        {row.gender}
                      </span>
                    ) : null}
                    {row.bloodType !== "—" ? (
                      <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
                        {row.bloodType}
                      </span>
                    ) : null}
                    {row.status}
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <MobileDetailSheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={selected ? selected.studentMeta : ""}
        description={selected ? `${selected.id} · Personal & contact` : undefined}
        rows={detailRows}
        footer={
          selected && canWrite && selected.internalId ? (
            <div className="py-1">
              <Link
                href={`/students/${encodeURIComponent(String(selected.internalId))}/edit`}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900/50"
              >
                Edit student
              </Link>
            </div>
          ) : undefined
        }
      />
    </>
  )
}
