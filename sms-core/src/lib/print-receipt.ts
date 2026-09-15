import { fetchWithAuth } from "@/lib/fetch-with-auth"

/**
 * Print the A5 payment receipt WITHOUT leaving the current page.
 *
 * Fetches the print-ready receipt HTML (same artifact the old flow opened
 * in a new tab), injects it into a hidden off-screen iframe, and lets the
 * receipt's own script fire the browser print dialog. The user stays on the
 * current screen — only the print dialog appears.
 *
 * The iframe is off-screen (not display:none) so the document keeps a real
 * viewport and the print layout (A5, 148×210mm) renders exactly.
 */
export async function printReceiptInPage(collectionId: string): Promise<void> {
  if (typeof window === "undefined") return

  const response = await fetchWithAuth(`/finance/payments/${collectionId}/receipt.print`)
  if (!response.ok) {
    throw new Error("Could not load the receipt for printing.")
  }
  const html = await response.text()

  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.tabIndex = -1
  iframe.style.position = "fixed"
  iframe.style.left = "-10000px"
  iframe.style.top = "0"
  iframe.style.width = "200mm"
  iframe.style.height = "240mm"
  iframe.style.border = "0"
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    throw new Error("Printing is not supported in this browser.")
  }

  let removed = false
  const cleanup = () => {
    if (removed) return
    removed = true
    iframe.remove()
  }

  // The receipt page auto-opens the print dialog shortly after load;
  // remove the carrier once printing ends (hard cap 60s as a safety net).
  iframe.contentWindow?.addEventListener("afterprint", cleanup)
  window.setTimeout(cleanup, 60_000)

  doc.open()
  doc.write(html)
  doc.close()
}
