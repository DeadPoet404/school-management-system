#!/usr/bin/env python3
"""SMS-007 (frontend): wire the print flow in payment-inflow-collection-log.tsx.

Edits (anchors captured from the user's CURRENT file via Z1-Z3 zone pastes):
  1. Pre-open a blank receipt tab SYNCHRONOUSLY inside handleProcessCollection
     (popup blockers deny window.open once the call stack crosses an await).
  2. On collection success, navigate that tab to the PDF; on failure, close it.
  3. On network error (catch), close it too.
  4. Retitle the existing per-row Printer button.
  5. Replace its placeholder toast onClick with a real window.open of the PDF.

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms007b.py
"""
from pathlib import Path

TARGET = Path("sms-core/src/components/payment-inflow-collection-log.tsx")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def main() -> None:
    if not TARGET.is_file():
        raise SystemExit(f"ABORT: {TARGET} not found. Run from ~/sms-monorepo.")
    c = TARGET.read_text(encoding="utf-8")
    if "receiptWindow" in c:
        print("SKIP: SMS-007 frontend already applied (receiptWindow present).")
        return

    # 1. Pre-open the tab before the async POST
    c = replace_once(
        c,
        '      // ✅ FIXED: removed the outer fetch() wrapper — fetchWithAuth IS the fetch\n'
        '      const response = await fetchWithAuth("/finance/collections", {\n',
        '      // SMS-007: pre-open the receipt tab synchronously — popup blockers deny window.open after an await\n'
        '      const receiptWindow = window.open("", "_blank")\n\n'
        '      // ✅ FIXED: removed the outer fetch() wrapper — fetchWithAuth IS the fetch\n'
        '      const response = await fetchWithAuth("/finance/collections", {\n',
        "pre-open receipt tab",
    )

    # 2. Success: navigate the tab to the PDF. Failure: close the blank tab.
    c = replace_once(
        c,
        '      if (payload.success) {\n'
        '        setHistory(prev => [payload.data, ...prev])\n'
        '        setFormState(DEFAULT_FORM_STATE())\n'
        '        fetchSectionData(activeSection)\n'
        '        setSuccessMessage(payload.message || "Payment collection recorded successfully.")\n'
        '      } else {\n',
        '      if (payload.success) {\n'
        '        setHistory(prev => [payload.data, ...prev])\n'
        '        setFormState(DEFAULT_FORM_STATE())\n'
        '        fetchSectionData(activeSection)\n'
        '        setSuccessMessage(payload.message || "Payment collection recorded successfully.")\n'
        '        if (receiptWindow) {\n'
        '          // SMS-007: pop the print-ready PDF (browser print-or-cancel flow)\n'
        '          receiptWindow.location.href = `/api/finance/payments/${payload.data.id}/receipt.pdf`\n'
        '        }\n'
        '      } else {\n'
        '        receiptWindow?.close()\n',
        "success path auto-open",
    )

    # 3. Network error: close the blank tab
    c = replace_once(
        c,
        '    } catch (error) {\n'
        '      console.error("[Collection Pipeline Ingress Write Error]:", error)\n',
        '    } catch (error) {\n'
        '      receiptWindow?.close()\n'
        '      console.error("[Collection Pipeline Ingress Write Error]:", error)\n',
        "catch path tab cleanup",
    )

    # 4. Retitle the per-row print button
    c = replace_once(
        c,
        'title="Print Physical Statement Receipt"',
        'title="Open Printable PDF Receipt"',
        "row button title",
    )

    # 5. Wire the row button to the real PDF endpoint
    c = replace_once(
        c,
        'onClick={() => setSuccessMessage(`Print protocol triggered for statement token serial: ${rcpt.receiptNumber}`)}',
        'onClick={() => window.open(`/api/finance/payments/${rcpt.id}/receipt.pdf`, "_blank", "noopener,noreferrer")}',
        "row button onClick",
    )

    TARGET.write_text(c, encoding="utf-8")
    print("OK: payment-inflow-collection-log.tsx — 5 SMS-007 edits applied.")
    print("Next: frontend gates (npm run lint && npm run build in sms-core), then rebuild the frontend image + hard refresh.")


if __name__ == "__main__":
    main()
