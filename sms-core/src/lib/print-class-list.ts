import { fetchWithAuth } from "@/lib/fetch-with-auth"

/**
 * Print the class list WITHOUT leaving the current page.
 *
 * Fetches the print-ready class-list HTML (same artifact the native flow
 * would open), injects it into a hidden off-screen iframe, and lets the
 * page's own script fire the browser's native print dialog — the standard
 * Ctrl+P dialog. The user stays on the current screen.
 *
 * The iframe is off-screen (not display:none) so the document keeps a real
 * viewport and the A4 print layout renders exactly.
 */
export async function printClassListInPage(classId: string): Promise<void> {
  if (typeof window === "undefined") return

  const response = await fetchWithAuth(
    `/students/class-list.print?classId=${encodeURIComponent(classId)}`,
  )
  if (!response.ok) {
    throw new Error("Could not load the class list for printing.")
  }
  const html = await response.text()

  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.tabIndex = -1
  iframe.style.position = "fixed"
  iframe.style.left = "-10000px"
  iframe.style.top = "0"
  iframe.style.width = "210mm"
  iframe.style.height = "297mm"
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

  // Remove the carrier once printing ends (hard cap 60s as a safety net).
  iframe.contentWindow?.addEventListener("afterprint", cleanup)
  window.setTimeout(cleanup, 60_000)

  doc.open()
  doc.write(html)
  doc.close()
}
