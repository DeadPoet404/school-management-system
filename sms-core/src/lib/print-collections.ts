import { fetchWithAuth } from "@/lib/fetch-with-auth";

/**
 * Print the daily payment register without leaving the current page.
 * The backend returns the same native-print HTML style as the class-list
 * report; the hidden iframe lets the browser open its normal print dialog.
 */
export async function printPaymentsInPage(date: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Choose a valid payment date first.");
  }

  const params = new URLSearchParams({ date });
  const response = await fetchWithAuth(
    `/finance/collections.print?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error("Could not load payments for printing.");
  }
  const html = await response.text();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "297mm";
  iframe.style.height = "210mm";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Printing is not supported in this browser.");
  }

  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };

  iframe.contentWindow?.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 60_000);

  doc.open();
  doc.write(html);
  doc.close();
}
