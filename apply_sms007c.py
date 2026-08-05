#!/usr/bin/env python3
"""SMS-007 follow-up C: repair the two gate failures after 007a.

1) BUILD_EXIT=2 / TS2322: src/__tests__/helpers/mock-repositories.ts
   createMockFinanceRepo() must satisfy IFinanceRepository, which SMS-007a
   extended with findReceiptCollectionById. Add the missing vi.fn() entry.

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms007c.py
"""
from pathlib import Path

TARGET = Path("sms-core-backend/src/__tests__/helpers/mock-repositories.ts")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def main() -> None:
    if not TARGET.is_file():
        raise SystemExit(f"ABORT: {TARGET} not found. Run from ~/sms-monorepo.")
    c = TARGET.read_text(encoding="utf-8")
    if "findReceiptCollectionById" in c:
        print("SKIP: mock helper already carries findReceiptCollectionById.")
        return
    c = replace_once(
        c,
        "    createCollection: vi.fn(),\n",
        "    createCollection: vi.fn(),\n"
        "    findReceiptCollectionById: vi.fn(),\n",
        "createMockFinanceRepo SMS-007 member",
    )
    TARGET.write_text(c, encoding="utf-8")
    print("OK: mock-repositories.ts — findReceiptCollectionById: vi.fn() added.")
    print("Now: rerun backend gates; then isolate the single failing test if it persists.")


if __name__ == "__main__":
    main()
