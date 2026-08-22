#!/usr/bin/env python3
"""SMS-008 (frontend): 'Print Transcript' per-row action on the real roster.

Placement rationale (verified): StudentAcademicsTable is a dead demo
component (never imported); the live academics/admin roster is the
/students Overview tab -> StudentOverviewTable, which already renders a
per-row actions cell gated by canWrite (ADMIN || STAFF — the exact role
pair the backend endpoint allows). We add a FileText icon button beside
the existing Edit link, opening the PDF in a new tab (browser print
flow), same idiom as SMS-007 receipts.

Edits to sms-core/src/components/student-overview-table.tsx:
  1. lucide import += FileText
  2. actions cell wrapped in a flex container + transcript print button

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms008b.py
"""
from pathlib import Path

TARGET = Path("sms-core/src/components/student-overview-table.tsx")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


OLD_ACTIONS = '''      actions: canWrite && attendanceRouteId ? (
        <Link
          href={`/students/${encodeURIComponent(String(attendanceRouteId))}/edit`}
          aria-label={`Edit ${student.studentName || "student"}`}
          title="Edit student"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      ) : ('''

NEW_ACTIONS = '''      actions: canWrite && attendanceRouteId ? (
        <div className="inline-flex items-center gap-1.5">
          <Link
            href={`/students/${encodeURIComponent(String(attendanceRouteId))}/edit`}
            aria-label={`Edit ${student.studentName || "student"}`}
            title="Edit student"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          {/* SMS-008: on-demand cumulative transcript PDF (browser print flow) */}
          <button
            type="button"
            aria-label={`Print transcript for ${student.studentName || "student"}`}
            title="Print Transcript"
            onClick={() => window.open(`/api/students/${encodeURIComponent(String(attendanceRouteId))}/transcript.pdf`, "_blank", "noopener,noreferrer")}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : ('''


def main() -> None:
    if not TARGET.is_file():
        raise SystemExit(f"ABORT: {TARGET} not found. Run from ~/sms-monorepo.")
    c = TARGET.read_text(encoding="utf-8")
    if "Print Transcript" in c:
        print("SKIP: transcript action already present.")
        return

    c = replace_once(
        c,
        'import { Pencil } from "lucide-react"',
        'import { FileText, Pencil } from "lucide-react"',
        "lucide FileText import",
    )
    c = replace_once(c, OLD_ACTIONS, NEW_ACTIONS, "actions cell transcript button")
    TARGET.write_text(c, encoding="utf-8")
    print("OK: student-overview-table.tsx — FileText import + per-row Print Transcript action.")
    print("Next: cd sms-core && npm run lint && npm run build, then docker compose up -d --build frontend + hard refresh.")


if __name__ == "__main__":
    main()
