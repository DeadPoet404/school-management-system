import { fetchWithAuth } from "@/lib/fetch-with-auth"

/**
 * Print every student who owes fees, without leaving the current page.
 * The printed amount is never a dash, including students who have not paid.
 */
export async function printFeesOwedInPage(): Promise<void> {
  if (typeof window === "undefined") return

  const response = await fetchWithAuth("/students/fees-owed.print")
  if (!response.ok) {
    throw new Error("Could not load the list of students who owe fees.")
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

  iframe.contentWindow?.addEventListener("afterprint", cleanup)
  window.setTimeout(cleanup, 60_000)

  doc.open()
  doc.write(html)
  doc.close()
}
