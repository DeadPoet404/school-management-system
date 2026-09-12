import { amountInWords } from './amount-in-words';
import type { ReceiptPdfData } from './pdf';

export type ReceiptPrintData = ReceiptPdfData & {
  /**
   * Reserved for the student-photo upload increment.
   *
   * The print receipt accepts a short-lived signed URL, never a storage key.
   * Until that backend flow exists, the A5 template renders its initials avatar.
   */
  studentPhotoUrl?: string | null;
};

const RECEIPT_CONTACT_FALLBACK = {
  email: 'jocomfyschool@gmail.com',
  phone: '+233 55 818 6259 · +233 24 263 8801',
  website: 'jocomfy.com',
  address: 'Accra, Ghana',
} as const;

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatMoney(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function receiptCurrency(value: string | null | undefined): string {
  const candidate = nonEmpty(value)?.toUpperCase();
  return candidate && /^[A-Z]{3}$/.test(candidate) ? candidate : 'GHS';
}

function safeImageSource(value: string | null | undefined): string | null {
  const candidate = nonEmpty(value);
  if (!candidate) return null;

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function studentInitials(studentName: string): string {
  const parts = studentName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();

  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Browser-native strict-A5 payment receipt.
 *
 * This is the primary printing artifact. It is intentionally HTML rather than
 * PDF so a finance action opens the native print window without downloading.
 */
export function renderReceiptPrintHtml(data: ReceiptPrintData): string {
  const institution = data.institution ?? null;
  const currency = receiptCurrency(institution?.currency);
  const schoolName = nonEmpty(institution?.schoolName) ?? 'Jocomfy School';
  const schoolCode = nonEmpty(institution?.schoolCode);
  const motto = nonEmpty(institution?.motto);
  const schoolAddress =
    nonEmpty(institution?.address) ?? RECEIPT_CONTACT_FALLBACK.address;
  const schoolPhone =
    nonEmpty(institution?.phone) ?? RECEIPT_CONTACT_FALLBACK.phone;
  const schoolEmail =
    nonEmpty(institution?.email) ?? RECEIPT_CONTACT_FALLBACK.email;
  const schoolWebsite = RECEIPT_CONTACT_FALLBACK.website;
  const schoolLogoUrl =
    safeImageSource(institution?.logoUrl) ??
    '/branding/jocomfy-school-logo.png';
  const studentPhotoUrl = safeImageSource(data.studentPhotoUrl);
  const initials = studentInitials(data.studentName);

  const outstandingBalance =
    data.outstandingBalance === null
      ? 'Not linked'
      : `${currency} ${formatMoney(data.outstandingBalance)}`;

  const studentPhotoMarkup = studentPhotoUrl
    ? `<img
          id="student-photo"
          class="student-photo"
          src="${escapeHtml(studentPhotoUrl)}"
          alt="${escapeHtml(data.studentName)}"
        >`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Receipt ${escapeHtml(data.receiptNumber)}</title>
  <style>
    @page { size: A5 portrait; margin: 0; }

    :root {
      color-scheme: light;
      --navy: #082a70;
      --navy-soft: #294b91;
      --gold: #e4b43c;
      --ink: #172341;
      --muted: #66708a;
      --line: #cfd5e3;
      --row: #eef1f7;
      --paper: #ffffff;
    }

    * { box-sizing: border-box; }

    html,
    body {
      margin: 0;
      min-height: 100%;
      background: #1239a4;
      color: var(--ink);
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt {
      width: 148mm;
      min-height: 210mm;
      margin: 16px auto;
      padding: 10mm 11mm 8mm;
      overflow: hidden;
      background: var(--paper);
      box-shadow: 0 20px 56px rgba(4, 20, 67, 0.35);
    }

    .top-rule {
      height: 1.2mm;
      margin: -10mm -11mm 5mm;
      background: var(--navy);
    }

    .identity-header {
      display: grid;
      grid-template-columns: 27mm minmax(0, 1fr) 39mm;
      gap: 4mm;
      align-items: center;
      min-height: 27mm;
      padding-bottom: 4.2mm;
    }

    .student-avatar {
      position: relative;
      display: grid;
      width: 27mm;
      height: 27mm;
      place-items: center;
      overflow: hidden;
      border: 1mm solid var(--gold);
      /* Admin 2026-09: square photo frame / fallback, not circular. */
      border-radius: 2mm;
      background: linear-gradient(145deg, #173d8c, var(--navy));
      box-shadow: inset 0 0 0 1.2mm #ffffff;
    }

    .avatar-fallback {
      display: grid;
      width: 100%;
      height: 100%;
      place-items: center;
      color: #ffffff;
    }

    .avatar-fallback svg {
      position: absolute;
      width: 18mm;
      height: 18mm;
      opacity: 0.25;
    }

    .avatar-initials {
      position: relative;
      z-index: 1;
      font-size: 11pt;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .student-avatar.has-photo .avatar-fallback {
      display: none;
    }

    .student-photo {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .student-summary {
      min-width: 0;
      padding-top: 0.8mm;
    }

    .student-summary-label {
      display: block;
      margin-bottom: 1.5mm;
      color: var(--gold);
      font-size: 6.2pt;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .student-name {
      margin: 0;
      color: var(--navy);
      font-size: 15pt;
      font-weight: 800;
      letter-spacing: -0.055em;
      line-height: 0.94;
      overflow-wrap: anywhere;
    }

    .student-index {
      display: block;
      margin-top: 2mm;
      color: #48546c;
      font-size: 7.2pt;
      font-weight: 700;
      line-height: 1.35;
    }

    .school-summary {
      display: grid;
      grid-template-columns: 13mm minmax(0, 1fr);
      column-gap: 2.3mm;
      align-items: center;
      min-width: 0;
    }

    .school-logo-frame {
      display: grid;
      width: 13mm;
      height: 13mm;
      place-items: center;
    }

    .school-logo-frame.is-missing {
      visibility: hidden;
    }

    .school-logo {
      display: block;
      max-width: 13mm;
      max-height: 13mm;
      object-fit: contain;
    }

    .school-contact {
      min-width: 0;
      color: #47556e;
      font-size: 5.6pt;
      line-height: 1.36;
      overflow-wrap: anywhere;
    }

    .school-contact strong {
      display: block;
      margin-bottom: 0.8mm;
      color: var(--navy);
      font-size: 6.4pt;
      font-weight: 800;
      line-height: 1.1;
    }

    .identity-divider {
      height: 0.5pt;
      background: #9ca6bb;
    }

    .receipt-banner {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 6mm;
      padding: 4.2mm 0 4.4mm;
    }

    .receipt-title {
      display: block;
      color: var(--navy);
      font-size: 15pt;
      font-weight: 800;
      letter-spacing: -0.06em;
      line-height: 0.92;
      text-transform: uppercase;
    }

    .receipt-subtitle {
      display: block;
      margin-top: 1.4mm;
      color: var(--muted);
      font-size: 6.3pt;
      font-weight: 800;
      letter-spacing: 0.105em;
      text-transform: uppercase;
    }

    .receipt-meta {
      color: var(--navy);
      font-size: 6.7pt;
      line-height: 1.5;
      text-align: right;
      white-space: nowrap;
    }

    .receipt-meta strong {
      display: inline-block;
      min-width: 13mm;
      color: var(--ink);
      font-weight: 800;
    }

    .payment-section {
      padding-top: 0.8mm;
    }

    .payment-heading {
      display: flex;
      align-items: center;
      gap: 3mm;
      margin: 0 0 2.5mm;
      color: var(--navy);
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.015em;
    }

    .payment-heading::after {
      flex: 1;
      height: 0.5pt;
      content: "";
      background: var(--line);
    }

    .payment-table {
      overflow: hidden;
      border-radius: 4mm;
    }

    .payment-row {
      display: grid;
      grid-template-columns: 10mm minmax(0, 1fr) 23mm 28mm;
      column-gap: 2mm;
      align-items: center;
    }

    .payment-row.header {
      min-height: 8.2mm;
      padding: 0 3mm;
      background: var(--navy);
      color: #ffffff;
      font-size: 6.7pt;
      font-weight: 700;
      letter-spacing: 0.025em;
    }

    .payment-row.body {
      min-height: 11.3mm;
      margin-top: 1.4mm;
      padding: 2mm 3mm;
      background: var(--row);
      color: var(--ink);
      font-size: 7.4pt;
      line-height: 1.25;
    }

    .payment-row > :nth-child(3),
    .payment-row > :nth-child(4) {
      text-align: right;
    }

    .payment-row.body > :nth-child(1) {
      color: var(--navy);
      font-size: 8pt;
      font-weight: 800;
    }

    .payment-row.body > :nth-child(2) {
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .payment-row.body > :nth-child(4) {
      color: var(--navy);
      font-size: 8.3pt;
      font-weight: 800;
      white-space: nowrap;
    }

    .total-area {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 55mm;
      gap: 7mm;
      align-items: end;
      padding-top: 5mm;
    }

    .amount-words-label {
      display: block;
      margin-bottom: 1.5mm;
      color: var(--muted);
      font-size: 6.2pt;
      font-weight: 800;
      letter-spacing: 0.095em;
      text-transform: uppercase;
    }

    .amount-words {
      margin: 0;
      color: #48546c;
      font-size: 7.1pt;
      font-style: italic;
      line-height: 1.45;
    }

    .totals {
      overflow: hidden;
      border-radius: 3mm;
    }

    .total-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
      min-height: 7.3mm;
      padding: 0 3.5mm;
      background: var(--row);
      color: #46536d;
      font-size: 7.2pt;
    }

    .total-line + .total-line {
      margin-top: 1.2mm;
    }

    .total-line strong {
      color: var(--ink);
      font-size: 8pt;
      white-space: nowrap;
    }

    .total-line.received {
      background: var(--navy);
      color: #ffffff;
      font-weight: 800;
    }

    .total-line.received strong {
      color: #ffffff;
      font-size: 8.8pt;
    }

    .decorative-dots {
      display: flex;
      justify-content: space-between;
      margin: 5.2mm 1mm 4.3mm;
    }

    .dot-pair {
      display: flex;
      gap: 3mm;
    }

    .dot {
      width: 3.1mm;
      height: 3.1mm;
      border-radius: 50%;
      background: var(--navy);
    }

    .dot.gold {
      background: var(--gold);
    }

    .lower-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8mm;
      padding: 4.2mm 0 4.6mm;
      border-top: 0.5pt solid var(--line);
    }

    .lower-grid h2 {
      margin: 0 0 2mm;
      color: var(--navy);
      font-size: 7.7pt;
      font-weight: 800;
    }

    .lower-grid p {
      margin: 0;
      color: #4a5872;
      font-size: 6.6pt;
      line-height: 1.44;
    }

    .payment-facts {
      display: grid;
      gap: 1.2mm;
      color: #4a5872;
      font-size: 6.6pt;
      line-height: 1.35;
    }

    .payment-facts span {
      display: grid;
      grid-template-columns: 18mm minmax(0, 1fr);
      gap: 2mm;
    }

    .payment-facts strong {
      color: var(--ink);
      font-weight: 800;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8mm;
      padding-top: 3mm;
      border-top: 0.5pt solid var(--line);
    }

    .signature-line {
      height: 6.5mm;
      border-bottom: 0.5pt solid #8e99ae;
    }

    .signature-label {
      display: block;
      margin-top: 1.5mm;
      color: var(--muted);
      font-size: 6pt;
      font-weight: 800;
      letter-spacing: 0.075em;
      text-transform: uppercase;
    }

    .receipt-footer {
      display: flex;
      justify-content: space-between;
      gap: 5mm;
      margin-top: 4.4mm;
      padding-top: 2.8mm;
      border-top: 0.5pt solid #9ca6bb;
      color: #56627b;
      font-size: 6.1pt;
      line-height: 1.35;
    }

    .receipt-footer span:last-child {
      text-align: right;
    }

    .screen-actions {
      position: fixed;
      right: 20px;
      bottom: 20px;
      display: flex;
      gap: 10px;
      z-index: 3;
    }

    .screen-actions button {
      border: 0;
      border-radius: 999px;
      padding: 10px 16px;
      background: var(--navy);
      color: #ffffff;
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
    }

    .screen-actions button.secondary {
      background: #64748b;
    }

    @media print {
      html,
      body {
        width: 148mm;
        min-height: 210mm;
        background: var(--paper);
      }

      .receipt {
        width: 148mm;
        min-height: 210mm;
        margin: 0;
        box-shadow: none;
      }

      .screen-actions {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <article class="receipt">
    <div class="top-rule"></div>

    <header class="identity-header">
      <div
        class="student-avatar${studentPhotoUrl ? ' has-photo' : ''}"
        id="student-avatar"
        aria-label="${escapeHtml(data.studentName)} profile photo"
      >
        <span class="avatar-fallback">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="21" r="11" fill="currentColor"></circle>
            <path d="M12 58c2-14 10-21 20-21s18 7 20 21" fill="currentColor"></path>
          </svg>
          <span class="avatar-initials">${escapeHtml(initials)}</span>
        </span>
        ${studentPhotoMarkup}
      </div>

      <section class="student-summary">
        <span class="student-summary-label">Student payment record</span>
        <h1 class="student-name">${escapeHtml(data.studentName)}</h1>
        <span class="student-index">
          Index: ${escapeHtml(data.studentCode ?? 'Walk-in collection')}
          ${data.className ? `&nbsp;&nbsp;•&nbsp;&nbsp;${escapeHtml(data.className)}` : ''}
        </span>
      </section>

      <aside class="school-summary">
        <div class="school-logo-frame" id="school-logo-frame">
          <img
            id="school-logo"
            class="school-logo"
            src="${escapeHtml(schoolLogoUrl)}"
            alt="${escapeHtml(schoolName)} logo"
          >
        </div>
        <div class="school-contact">
          <strong>${escapeHtml(schoolName)}</strong>
          ${schoolCode ? `${escapeHtml(schoolCode)}<br>` : ''}
          ${escapeHtml(schoolPhone)}<br>
          ${escapeHtml(schoolEmail)}<br>
          ${escapeHtml(schoolWebsite)}
        </div>
      </aside>
    </header>

    <div class="identity-divider"></div>

    <section class="receipt-banner">
      <div>
        <span class="receipt-title">Payment Receipt</span>
        <span class="receipt-subtitle">
          ${motto ? escapeHtml(motto) : 'Official school payment confirmation'}
        </span>
      </div>

      <div class="receipt-meta">
        <div><strong>No:</strong> ${escapeHtml(data.receiptNumber)}</div>
        <div><strong>Date:</strong> ${escapeHtml(formatDate(data.dateProcessed))}</div>
        <div><strong>Method:</strong> ${escapeHtml(data.paymentMethod)}</div>
      </div>
    </section>

    <section class="payment-section">
      <h2 class="payment-heading">Payment allocation</h2>

      <div class="payment-table" role="table" aria-label="Payment allocation">
        <div class="payment-row header" role="row">
          <span>No.</span>
          <span>Fee allocation</span>
          <span>Method</span>
          <span>Amount</span>
        </div>
        <div class="payment-row body" role="row">
          <span>01</span>
          <span>${escapeHtml(data.allocationTarget)}</span>
          <span>${escapeHtml(data.paymentMethod)}</span>
          <span>${escapeHtml(currency)} ${escapeHtml(formatMoney(data.amountPaid))}</span>
        </div>
      </div>
    </section>

    <section class="total-area">
      <div>
        <span class="amount-words-label">Amount in words</span>
        <p class="amount-words">${escapeHtml(amountInWords(data.amountPaid))}</p>
      </div>

      <div class="totals">
        <div class="total-line">
          <span>Outstanding balance</span>
          <strong>${escapeHtml(outstandingBalance)}</strong>
        </div>
        <div class="total-line received">
          <span>Amount received</span>
          <strong>${escapeHtml(currency)} ${escapeHtml(formatMoney(data.amountPaid))}</strong>
        </div>
      </div>
    </section>

    <div class="decorative-dots" aria-hidden="true">
      <div class="dot-pair"><span class="dot"></span><span class="dot gold"></span></div>
      <div class="dot-pair"><span class="dot gold"></span><span class="dot"></span></div>
    </div>

    <section class="lower-grid">
      <div>
        <h2>Receipt terms</h2>
        <p>
          This receipt confirms the payment received and allocated above.
          Please retain it as proof of payment for your school records.
        </p>
      </div>

      <div>
        <h2>Payment details</h2>
        <div class="payment-facts">
          <span><strong>Reference</strong><span>${escapeHtml(data.referenceNo)}</span></span>
          <span><strong>Processed</strong><span>${escapeHtml(formatDate(data.dateProcessed))}</span></span>
          <span><strong>Receipt no.</strong><span>${escapeHtml(data.receiptNumber)}</span></span>
        </div>
      </div>
    </section>

    <section class="signature-grid">
      <div>
        <div class="signature-line"></div>
        <span class="signature-label">Received by</span>
      </div>
      <div>
        <div class="signature-line"></div>
        <span class="signature-label">Signature &amp; stamp</span>
      </div>
    </section>

    <footer class="receipt-footer">
      <span>${escapeHtml(schoolAddress)}</span>
      <span>${escapeHtml(schoolWebsite)} &nbsp;|&nbsp; ${escapeHtml(schoolEmail)}</span>
    </footer>
  </article>

  <div class="screen-actions" aria-label="Receipt print controls">
    <button type="button" onclick="window.print()">Print receipt</button>
    <button type="button" class="secondary" onclick="window.close()">Close</button>
  </div>

  <script>
    (function () {
      const schoolLogo = document.getElementById("school-logo");
      const schoolLogoFrame = document.getElementById("school-logo-frame");
      const studentPhoto = document.getElementById("student-photo");
      const studentAvatar = document.getElementById("student-avatar");

      // The print dialog must open promptly even when the storage-hosted
      // photo or logo is slow to arrive: each image gets a bounded wait,
      // and the flow starts when the DOM is ready instead of after every
      // page resource has finished loading (window.load).
      const PHOTO_WAIT_MS = 2500;
      const LOGO_WAIT_MS = 1500;

      function waitForImage(image, timeoutMs, onFailure) {
        if (!image) return Promise.resolve();

        if (image.complete) {
          if (!image.naturalWidth && onFailure) onFailure();
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          let settled = false;
          const settle = (failed) => {
            if (settled) return;
            settled = true;
            if (failed && onFailure) onFailure();
            resolve();
          };
          const timer = window.setTimeout(() => settle(true), timeoutMs);
          image.addEventListener("load", () => {
            window.clearTimeout(timer);
            settle(false);
          }, { once: true });
          image.addEventListener("error", () => {
            window.clearTimeout(timer);
            settle(true);
          }, { once: true });
        });
      }

      function startPrintFlow() {
        const schoolLogoTask = waitForImage(schoolLogo, LOGO_WAIT_MS, () => {
          if (schoolLogoFrame) schoolLogoFrame.classList.add("is-missing");
        });

        const studentPhotoTask = waitForImage(studentPhoto, PHOTO_WAIT_MS, () => {
          if (studentAvatar) studentAvatar.classList.remove("has-photo");
          if (studentPhoto) studentPhoto.remove();
        });

        Promise.all([schoolLogoTask, studentPhotoTask]).finally(() => {
          window.setTimeout(() => window.print(), 180);
        });
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startPrintFlow, { once: true });
      } else {
        startPrintFlow();
      }
    }());
  </script>
</body>
</html>`;
}
