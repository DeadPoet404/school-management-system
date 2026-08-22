#!/usr/bin/env python3
"""SMS-009: Attendance Registry module in the Operations sidebar.

Two changes, both frontend:
  1) operations-manifest.ts -- new module entry in "Academic Operations":
       { id: "attendance-registry", title: "Attendance Registry",
         action: { type: "route", path: "/operations/attendance" } }
  2) role-access.ts -- OPERATIONS_BY_ROLE: FACULTY, ADMIN and STAFF gain
     "attendance-registry" (ACCOUNTANT + STUDENT stay without it).

Backend caveat (ratified in the frozen backlog, verified structurally):
  GET sheet/history = FACULTY/ADMIN/STAFF (view works), POST submit =
  FACULTY-only (writes 403 for ADMIN/STAFF by design).

Anchor note for (2): SMS-001 appended "ca-gradebook" as the LAST element of
the ADMIN and STAFF arrays; FACULTY was already ["ca-gradebook"]. So the
string '"ca-gradebook"],' occurs exactly 3 times (ADMIN, STAFF, FACULTY).
If your 001 variant differs, this script ABORTs harmlessly — paste me the
OPERATIONS_BY_ROLE block and I'll re-cut the anchor.

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms009.py
"""
from pathlib import Path

MANIFEST = Path("sms-core/src/lib/operations-manifest.ts")
ROLE_ACCESS = Path("sms-core/src/lib/role-access.ts")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def replace_expected(content: str, old: str, new: str, expected: int, label: str) -> str:
    n = content.count(old)
    if n != expected:
        raise SystemExit(f"ABORT [{label}]: expected {expected} anchors, found {n}. Patch NOT applied.")
    return content.replace(old, new)


def main() -> None:
    if not MANIFEST.is_file() or not ROLE_ACCESS.is_file():
        raise SystemExit("ABORT: target files not found. Run from ~/sms-monorepo.")

    m = MANIFEST.read_text(encoding="utf-8")
    if "attendance-registry" in m:
        print("SKIP: manifest already carries attendance-registry.")
    else:
        m = replace_once(
            m,
            '      {\n'
            '        id: "class-gen",\n'
            '        title: "Timetable & Scheduling",\n'
            '        action: { type: "view", component: TimetableStructureSetup },\n'
            '      },\n'
            '    ],\n',
            '      {\n'
            '        id: "class-gen",\n'
            '        title: "Timetable & Scheduling",\n'
            '        action: { type: "view", component: TimetableStructureSetup },\n'
            '      },\n'
            '      {\n'
            '        id: "attendance-registry",\n'
            '        title: "Attendance Registry",\n'
            '        action: { type: "route", path: "/operations/attendance" },\n'
            '      },\n'
            '    ],\n',
            "manifest attendance module",
        )
        MANIFEST.write_text(m, encoding="utf-8")
        print("OK: operations-manifest.ts — Attendance Registry module added.")

    r = ROLE_ACCESS.read_text(encoding="utf-8")
    if '"attendance-registry"' in r:
        print("SKIP: role-access already grants attendance-registry.")
    else:
        r = replace_expected(
            r,
            '"ca-gradebook"],',
            '"ca-gradebook", "attendance-registry"],',
            3,
            "OPERATIONS_BY_ROLE attendance-registry grants (ADMIN/STAFF/FACULTY)",
        )
        ROLE_ACCESS.write_text(r, encoding="utf-8")
        print("OK: role-access.ts — attendance-registry granted to FACULTY, ADMIN, STAFF.")

    print()
    print("Next: cd sms-core && npm run lint && npm run build, then docker compose up -d --build frontend,")
    print("hard refresh, and verify the Operations sidebar shows Attendance Registry for FACULTY/ADMIN/STAFF.")


if __name__ == "__main__":
    main()
