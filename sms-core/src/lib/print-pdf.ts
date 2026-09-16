/**
 * Print a PDF (from a blob object URL) WITHOUT leaving the current page.
 *
 * Injects the PDF into a hidden off-screen iframe and fires the browser
 * print dialog from the iframe's viewer. The user stays on the current
 * screen — only the print dialog appears.
 *
 * The iframe is off-screen but has a real size (not display:none) so the
 * PDF viewer keeps a genuine viewport and prints the layout exactly.
 *
 * If the browser's viewer cannot be scripted (print missing), falls back
 * to opening the PDF in a new tab.
 */
export function printPdfInPage(url: string): void {
  if (typeof window === "undefined") return

  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.tabIndex = -1
  iframe.style.position = "fixed"
  iframe.style.left = "-10000px"
  iframe.style.top = "0"
  // A4 at 96dpi is ~794x1123px — give the viewer a real page-sized viewport.
  iframe.style.width = "820px"
  iframe.style.height = "1150px"
  iframe.style.border = "0"
  document.body.appendChild(iframe)

  let finished = false
  const finish = (revokeNow: boolean) => {
    if (finished) return
    finished = true
    iframe.remove()
    if (revokeNow) {
      URL.revokeObjectURL(url)
    } else {
      // Keep the blob alive for the fallback tab, then release it.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }
  }

  const doPrint = () => {
    const win = iframe.contentWindow
    if (win && typeof win.print === "function") {
      win.focus()
      win.print()
      // Remove the carrier once the user closes the print dialog
      // (60s hard cap as a safety net).
      win.addEventListener("afterprint", () => finish(true))
      window.setTimeout(() => finish(true), 60_000)
    } else {
      // This browser won't print a PDF in place — fall back to a tab.
      window.open(url, "_blank")
      finish(false)
    }
  }

  iframe.onload = () => {
    // Let the PDF viewer finish parsing before firing the dialog.
    window.setTimeout(doPrint, 400)
  }

  // Safety net if the viewer never fires load.
  window.setTimeout(() => finish(true), 90_000)

  iframe.src = url
}
