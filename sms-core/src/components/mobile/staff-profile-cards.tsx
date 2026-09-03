"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { StaffProfileRow } from "@/components/staff-profile-table"
import { MobileCardList, type MobileCardItem } from "@/components/mobile/mobile-card-list"

interface StaffProfileCardsProps {
  rows: StaffProfileRow[]
}

const genderChipClass = (gender: string) =>
  gender === "Male"
    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
    : gender === "Female"
      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"

/** Mobile (below-lg) staff personal-info registry: card list + detail sheet. */
export function StaffProfileCards({ rows }: StaffProfileCardsProps) {
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
          primary: row.staffMeta,
          meta: (
            <>
              {row.id}
              {row.email !== "N/A" ? ` · ${row.email}` : ""}
            </>
          ),
          chips: [genderChip, bloodChip, row.status],
          sheetTitle: row.staffMeta,
          sheetDescription: `${row.id} · Personal & contact`,
          sheetRows: [
            { label: "Staff ID", value: row.id },
            {
              label: "Email",
              value:
                row.email !== "N/A" ? (
                  <a
                    href={`mailto:${row.email}`}
                    className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 break-all dark:text-blue-400"
                  >
                    {row.email}
                  </a>
                ) : (
                  "N/A"
                ),
            },
            {
              label: "Phone",
              value:
                row.phone !== "—" ? (
                  <a
                    href={`tel:${row.phone.replace(/[^+\d]/g, "")}`}
                    className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
                  >
                    {row.phone}
                  </a>
                ) : (
                  "—"
                ),
            },
            { label: "Date of Birth", value: row.dateOfBirth },
            { label: "Gender", value: row.gender },
            { label: "Blood Group", value: row.bloodGroup },
            { label: "Religion", value: row.religion },
            { label: "Primary Address", value: row.address },
            { label: "Prior Institution", value: row.priorInstitution },
            { label: "National ID / Ghana Card", value: row.ghanaCard },
            { label: "SSNIT Number", value: row.ssnitNumber },
            { label: "Emergency Contact Name", value: row.emergencyName },
            {
              label: "Emergency Phone",
              value:
                row.emergencyPhone !== "—" ? (
                  <a
                    href={`tel:${row.emergencyPhone.replace(/[^+\d]/g, "")}`}
                    className="font-mono text-[13px] text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
                  >
                    {row.emergencyPhone}
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
      emptyMessage="No staff personal-info records found."
    />
  )
}
