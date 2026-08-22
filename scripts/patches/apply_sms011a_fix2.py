#!/usr/bin/env python3
"""SMS-011 hotfix 2: align the expense-breakdown test with the ratified clamp.

The spec ratified ?months= clamped 3-24 with default 12. The test wrongly
requested a 2-month window, so the service (correctly) clamped up to 3 and
zero-filled the leading month. Fixes the TEST, not the service: request 3
months and expect the zero-filled leading 2026-07 netPosition row.

Idempotent. Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms011a_fix2.py
"""
from pathlib import Path

TEST = Path("sms-core-backend/src/__tests__/unit/services/analytics.service.test.ts")

OLD_CALL = "      const data = await service.getExpenseBreakdown(2);"
NEW_CALL = "      const data = await service.getExpenseBreakdown(3);"

OLD_EXPECT = """      expect(data.netPosition).toEqual([
        { month: '2026-08', collections: 0, expenses: 400, net: -400 },
        { month: '2026-09', collections: 1000, expenses: 200, net: 800 },
      ]);"""
NEW_EXPECT = """      expect(data.netPosition).toEqual([
        { month: '2026-07', collections: 0, expenses: 0, net: 0 },
        { month: '2026-08', collections: 0, expenses: 400, net: -400 },
        { month: '2026-09', collections: 1000, expenses: 200, net: 800 },
      ]);"""


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def main() -> None:
    if not TEST.is_file():
        raise SystemExit(f"ABORT: {TEST} not found. Run from ~/sms-monorepo.")
    c = TEST.read_text(encoding="utf-8")

    if NEW_CALL in c and "2026-07', collections: 0, expenses: 0, net: 0" in c:
        print("SKIP: expense-breakdown test already aligned with the 3-month clamp.")
    else:
        c = replace_once(c, OLD_CALL, NEW_CALL, "months arg 2->3 (clamp floor is 3)")
        c = replace_once(c, OLD_EXPECT, NEW_EXPECT, "netPosition expectation += zero-filled 2026-07")
        TEST.write_text(c, encoding="utf-8")
        print("OK: expense-breakdown test now requests 3 months + expects the zero-filled July row.")

    final = TEST.read_text(encoding="utf-8")
    checks = {
        "call uses clamped-safe 3":       "getExpenseBreakdown(3)" in final,
        "no sub-clamp call remains":      "getExpenseBreakdown(2)" not in final,
        "zero-filled July expected":      "{ month: '2026-07', collections: 0, expenses: 0, net: 0 }," in final,
    }
    bad = [k for k, ok in checks.items() if not ok]
    for k, ok in checks.items():
        print(f"  {'PASS' if ok else 'FAIL'}  {k}")
    if bad:
        raise SystemExit("ABORT: post-verify failed -- report this output.")
    print("FIX2_EXIT=0")


if __name__ == "__main__":
    main()
