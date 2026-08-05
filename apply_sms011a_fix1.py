#!/usr/bin/env python3
"""SMS-011 hotfix 1: restore the discarded helper definitions.

Root cause (patch-script bug, repo content otherwise correct): apply_sms011a's
edit() helper re-read the file from disk per call, so the SECOND edit on
analytics.service.ts / analytics.controller.ts overwrote the FIRST one. The 9
methods/handlers landed but their module-scope helpers (clampMonths,
monthWindow, monthKey, parseYmd, entityFromPath / parseQueryInt) were lost,
producing 22 ESLint no-undef errors.

This script inserts ONLY the missing helper blocks. Guards:
  * aborts if the SMS-011 methods/handlers are somehow absent (wrong state --
    report instead of patching);
  * skips cleanly if the helpers are already present (idempotent).

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms011a_fix1.py
"""
from pathlib import Path

BACKEND = Path("sms-core-backend")

SERVICE_HELPERS = '''function clampMonths(months: number | undefined): number {
  if (!months || !Number.isFinite(months)) return 12;
  return Math.min(Math.max(Math.floor(months), 3), 24);
}

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.floor(limit), 1), max);
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Ascending first-of-month UTC dates covering the current month and (months - 1) back. */
function monthWindow(months: number): Date[] {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  return Array.from({ length: months }, (_, index) => {
    const d = new Date(first);
    d.setUTCMonth(first.getUTCMonth() + index);
    return d;
  });
}

/** Strict YYYY-MM-DD (UTC) parser; anything else returns null (caller falls back to today). */
function parseYmd(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** '/api/students/123' -> 'students'; '/health' -> 'health'. */
function entityFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[1] ?? segments[0] ?? 'root';
}

'''

CONTROLLER_HELPER = '''function parseQueryInt(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

'''


def insert_before_once(content: str, anchor: str, block: str, label: str) -> str:
    n = content.count(anchor)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(anchor, block + anchor, 1)


def main() -> None:
    if not BACKEND.is_dir():
        raise SystemExit("ABORT: sms-core-backend/ not found. Run from ~/sms-monorepo.")

    service = BACKEND / "src/modules/analytics/analytics.service.ts"
    controller = BACKEND / "src/modules/analytics/analytics.controller.ts"

    sc = service.read_text(encoding="utf-8")
    cc = controller.read_text(encoding="utf-8")

    # Guard: methods/handlers from 011a must already be present, else state is
    # not what this hotfix assumes -- stop and report rather than half-patch.
    for marker, name in (
        ("getReceivablesAging", "service methods"),
        ("getCollectionsByChannel", "controller handlers"),
    ):
        if marker not in (sc if "service" in name else cc):
            raise SystemExit(f"ABORT: expected {name} already applied ({marker} missing). Report this state.")

    if "function clampMonths" in sc:
        print("SKIP: service helpers already present.")
    else:
        sc = insert_before_once(sc, "export class AnalyticsService {\n", SERVICE_HELPERS, "service helpers")
        service.write_text(sc, encoding="utf-8")
        print("OK: service helpers inserted (clampMonths, clampLimit, monthKey, monthWindow, parseYmd, entityFromPath).")

    if "function parseQueryInt" in cc:
        print("SKIP: controller parseQueryInt already present.")
    else:
        cc = insert_before_once(cc, "export class AnalyticsController {\n", CONTROLLER_HELPER, "controller parseQueryInt")
        controller.write_text(cc, encoding="utf-8")
        print("OK: controller parseQueryInt inserted.")

    # Post-verify: every no-undef identifier from the lint report now has exactly
    # one definition site, and the composed files are coherent.
    sc = service.read_text(encoding="utf-8")
    cc = controller.read_text(encoding="utf-8")
    checks = {
        "clampMonths defined once":     sc.count("function clampMonths") == 1,
        "clampLimit defined once":      sc.count("function clampLimit") == 1,
        "monthKey defined once":        sc.count("function monthKey") == 1,
        "monthWindow defined once":     sc.count("function monthWindow") == 1,
        "parseYmd defined once":        sc.count("function parseYmd") == 1,
        "entityFromPath defined once":  sc.count("function entityFromPath") == 1,
        "service methods intact":       sc.count("async get") >= 10,  # getDashboard + 9 new
        "parseQueryInt defined once":   cc.count("function parseQueryInt") == 1,
        "controller handlers intact":   cc.count("async (") >= 10,
        "class still opens correctly":  "export class AnalyticsService {" in sc and "export class AnalyticsController {" in cc,
    }
    bad = [k for k, ok in checks.items() if not ok]
    for k, ok in checks.items():
        print(f"  {'PASS' if ok else 'FAIL'}  {k}")
    if bad:
        raise SystemExit("ABORT: post-verify failed -- do not run gates; report this output.")
    print()
    print("Hotfix applied cleanly. Re-run the gate chain.")
    print("FIX011_EXIT=0")


if __name__ == "__main__":
    main()
