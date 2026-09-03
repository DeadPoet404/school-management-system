"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { TeacherProfileRow } from "@/components/teacher-profile-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface TeacherProfileCardsProps {
  rows: TeacherProfileRow[]
}

const genderChipClass = (gender: string) =>
  gender === "Male"
    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
    : gender === "Female"
      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"

/** Mobile (below-lg) teacher personal-info registry: card list + detail sheet. */
export function TeacherProfileCards({ rows }: TeacherProfileCardsProps) {
  const items = React.useMemo<MobileCardItem[]>(
    () =>
      rows.map((row) => {
        const genderChip =
          row.gender !== "—" ? (
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                genderChipClass(row.gender)
              )}
            >
              {row.gender}
            </span>
          ) : null

        const bloodChip =
          row.bloodGroup !== "—" ? (
            <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
              {row.bloodGroup}
            </span>
          ) : null

        return {
          id: row.id,
          primary: row.teacherName,
          meta: (
            <>
              {row.id}
              {row.institutionalEmail !== "N/A"
                ? ` · ${row.institutionalEmail}`
                : ""}
            </>
          ),
          chips: [genderChip, bloodChip],
          sheetTitle: row.teacherName,
          sheetDescription: `${row.id} · Personal & contact`,
          sheetRows: [
            { label: "Teacher ID", value: row.id },
            {
              label: "Institutional Email",
              value:
                row.institutionalEmail !== "N/A" ? (
                  <a
                    href={`mailto:${row.institutionalEmail}`}
                    className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 break-all dark:text-blue-400"
                  >
                    {row.institutionalEmail}
                  </a>
                ) : (
                  "N/A"
                ),
            },
            {
              label: "Mobile Number",
              value:
                row.mobileNumber !== "—" ? (
                  <a
                    href={`tel:${row.mobileNumber.replace(/[^+\d]/g, "")}`}
                    className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
                  >
                    {row.mobileNumber}
                  </a>
                ) : (
                  "—"
                ),
            },
            { label: "Date of Birth", value: row.dateOfBirth },
            { label: "Gender", value: row.gender },
            { label: "Blood Group", value: row.bloodGroup },
            { label: "Religion", value: row.religion },
            { label: "Primary Address", value: row.primaryAddress },
            { label: "Prior Education", value: row.priorEducation },
            { label: "National ID / Ghana Card", value: row.ghanaCard },
            {
              label: "Emergency Contact",
              value:
                row.emergencyContact !== "—" ? (
                  <a
                    href={`tel:${row.emergencyContact.replace(/[^+\d]/g, "")}`}
                    className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
                  >
                    {row.emergencyContact}
                  </a>
                ) : (
                  "—"
                ),
            },
          ],
        }
      }),
    [rows]
  )

  return (
    <MobileCardList
      rows={items}
      emptyMessage="No teacher personal-info records found."
    />
  )
}
