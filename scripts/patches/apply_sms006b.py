#!/usr/bin/env python3
"""SMS-006 follow-up B: fix the two noUncheckedIndexedAccess errors.

Same class of strict-typing error as SMS-005c: manual mock.calls[0][0]
indexing trips 'Object is possibly undefined' under the repo's strict
index-access checking (Vitest transpiles only — hence 267/267 green while
tsc fails). Optional chaining yields identical runtime behaviour.

  receipt-mail.test.ts:114  const mail = mockTransportSend.mock.calls[0][0];
  receipt-mail.test.ts:129  expect(mockTransportSend.mock.calls[0][0].subject)...

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms006b.py
"""
from pathlib import Path

TARGET = Path("sms-core-backend/src/__tests__/unit/lib/receipt-mail.test.ts")

FIXES = [
    (
        "const mail = mockTransportSend.mock.calls[0][0];",
        "const mail = mockTransportSend.mock.calls[0]?.[0];",
        "T1 mail arg access",
    ),
    (
        "expect(mockTransportSend.mock.calls[0][0].subject).toContain('Paystack digital payment');",
        "expect(mockTransportSend.mock.calls[0]?.[0].subject).toContain('Paystack digital payment');",
        "T2 subject access",
    ),
]


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def main() -> None:
    if not TARGET.is_file():
        raise SystemExit(f"ABORT: {TARGET} not found. Run from ~/sms-monorepo.")
    c = TARGET.read_text(encoding="utf-8")
    if "calls[0]?.[0]" in c:
        print("SKIP: optional-chaining fixes already present.")
        return
    for old, new, label in FIXES:
        c = replace_once(c, old, new, label)
    TARGET.write_text(c, encoding="utf-8")
    print("OK: receipt-mail.test.ts — 2 optional-chaining fixes applied.")
    print("Re-run: npm run test + npm run build, then the docker rebuild + SMS-006 log smoke.")


if __name__ == "__main__":
    main()
