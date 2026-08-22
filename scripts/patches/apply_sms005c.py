#!/usr/bin/env python3
"""SMS-005 follow-up C: fix the single tsc strict-typing error in portal.me.test.ts.

BUILD_EXIT=2 was caused by:
  src/__tests__/unit/controllers/portal.me.test.ts:130
  TS2532: Object is possibly 'undefined'.
      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });

Under the repo's strict index-access checking, next.mock.calls[0] is
T | undefined, so [0][0] fails type-check (Vitest transpiles only, which
is why all 234 tests passed at runtime). Optional chaining yields the
identical runtime value here — zero behavioural change.

Run from ~/sms-monorepo:
    cd ~/sms-monorepo && python3 apply_sms005c.py
"""
from pathlib import Path

TARGET = Path("sms-core-backend/src/__tests__/unit/controllers/portal.me.test.ts")

OLD = "expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });"
NEW = "expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403 });"


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def main() -> None:
    if not TARGET.is_file():
        raise SystemExit(
            f"ABORT: {TARGET} not found. Run this script from ~/sms-monorepo "
            "(and make sure apply_sms005b.py was applied first)."
        )
    content = TARGET.read_text(encoding="utf-8")
    if NEW in content:
        print(f"SKIP: fix already present in {TARGET} — nothing to do.")
        return
    content = replace_once(content, OLD, NEW, "portal.me tsc fix")
    TARGET.write_text(content, encoding="utf-8")
    print(f"OK: patched {TARGET}")
    print("  line 130: next.mock.calls[0][0] -> next.mock.calls[0]?.[0]")
    print()
    print("Now re-run gates, then the no-cache docker rebuild + smoke block.")


if __name__ == "__main__":
    main()
