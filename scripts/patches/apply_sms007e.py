#!/usr/bin/env python3
"""SMS-007 follow-up E: fix the receiptWindow scoping bug.

Type error from next build:
  payment-inflow-collection-log.tsx:200  Cannot find name 'receiptWindow'
The const was declared INSIDE the try block, so the catch block (which
closes the blank tab on network errors) could not see it. Hoist the
declaration above `try {`. Single edit.

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms007e.py
"""
from pathlib import Path

TARGET = Path("sms-core/src/components/payment-inflow-collection-log.tsx")

OLD = (
    "    setSubmitting(true)\n"
    "    try {\n"
    "      // SMS-007: pre-open the receipt tab synchronously — popup blockers deny window.open after an await\n"
    "      const receiptWindow = window.open(\"\", \"_blank\")\n"
    "\n"
    "      // ✅ FIXED: removed the outer fetch() wrapper — fetchWithAuth IS the fetch\n"
)
NEW = (
    "    setSubmitting(true)\n"
    "\n"
    "    // SMS-007: pre-open the receipt tab synchronously — popup blockers deny window.open after an await.\n"
    "    // Declared OUTSIDE try so the catch block can close the tab on network errors.\n"
    "    const receiptWindow = window.open(\"\", \"_blank\")\n"
    "\n"
    "    try {\n"
    "      // ✅ FIXED: removed the outer fetch() wrapper — fetchWithAuth IS the fetch\n"
)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def main() -> None:
    if not TARGET.is_file():
        raise SystemExit(f"ABORT: {TARGET} not found. Run from ~/sms-monorepo.")
    c = TARGET.read_text(encoding="utf-8")
    if "declared OUTSIDE try" in c:
        print("SKIP: receiptWindow already hoisted.")
        return
    c = replace_once(c, OLD, NEW, "receiptWindow hoist")
    TARGET.write_text(c, encoding="utf-8")
    print("OK: receiptWindow declaration hoisted above try {}.")
    print("Now: cd sms-core && npm run lint && npm run build && docker compose up -d --build frontend")


if __name__ == "__main__":
    main()
