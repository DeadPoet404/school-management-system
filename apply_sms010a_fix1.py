#!/usr/bin/env python3
r"""SMS-010 hotfix 1 -- escapeIcsText double-encoding bug (src/lib/calendar.ts).

Why: apply_sms010a emitted JS-level '\\;' / '\\,' / '\\n' inside escapeIcsText.
In the emitted TS source those became '\;' / '\,' (useless escapes -- ESLint
errors) and a newline-to-newline no-op, so commas/semicolons were never
backslash-escaped and the golden escape test failed. This rewrites that single
return statement to the correct, RFC 5545-compliant form.

Idempotent. Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms010a_fix1.py
"""
from pathlib import Path

BACKEND = Path("sms-core-backend")

OLD = r"""  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\,').replace(/\n/g, '\n');"""

NEW = r"""  return value
    .replace(/\\/g, '\\\\')   // backslash first -- order matters
    .replace(/;/g, '\\;')     // RFC 5545 section 4.3.11 TEXT escaping
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');   // literal LF -> two-char \n sequence"""


def main() -> None:
    path = BACKEND / "src/lib/calendar.ts"
    if not path.is_file():
        raise SystemExit("ABORT: sms-core-backend/src/lib/calendar.ts not found. Run from ~/sms-monorepo.")

    content = path.read_text(encoding="utf-8")

    if NEW in content:
        print("SKIP: escapeIcsText already fixed.")
    else:
        n = content.count(OLD)
        if n != 1:
            raise SystemExit(f"ABORT [escapeIcsText]: expected 1 anchor, found {n}. Patch NOT applied.")
        content = content.replace(OLD, NEW, 1)
        path.write_text(content, encoding="utf-8")
        print("OK: escapeIcsText rewritten (correct \\; \\, \\n source-level escapes).")

    # Post-verify the exact byte-level shape ESLint will parse:
    fixed = path.read_text(encoding="utf-8")
    checks = {
        "double-backslash-semicolon ('\\\\;')": ".replace(/;/g, '\\\\;')" in fixed,
        "double-backslash-comma     ('\\\\,')": ".replace(/,/g, '\\\\,')" in fixed,
        "LF -> literal backslash-n  ('\\\\n')": ".replace(/\\n/g, '\\\\n')" in fixed,
        "useless '\\;' escape gone":            "'\\;'" not in fixed,
        "useless '\\,' escape gone":            "'\\,'" not in fixed,
    }
    bad = [k for k, ok in checks.items() if not ok]
    for k, ok in checks.items():
        print(f"  {'PASS' if ok else 'FAIL'}  {k}")
    if bad:
        raise SystemExit("ABORT: post-verify failed -- do not run gates; report this output.")
    print("FIX1_EXIT=0")


if __name__ == "__main__":
    main()
