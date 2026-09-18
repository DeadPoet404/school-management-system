/**
 * Print-ready HTML for the daily payment register.
 *
 * This deliberately follows the class-list print template: the same
 * JOCOMFY letterhead, navy/gold rules, cream summary bar, zebra table and
 * browser-native print dialog flow. The selected date is a calendar date in
 * Africa/Accra (UTC), matching the finance date filter.
 */

export interface CollectionsPrintRow {
  receiptNumber: string;
  studentName: string;
  studentCode: string | null;
  className: string;
  amountPaid: number;
  paymentMethod: string;
  referenceNo: string;
  allocationTarget: string;
  dateProcessed: Date | string;
}

export interface CollectionsPrintData {
  date: string;
  payments: CollectionsPrintRow[];
  totalAmount: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value: number): string {
  return `₵${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function dateOnlyLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 ? `${day} ${MONTHS[month - 1]} ${match[1]}` : value;
}

function timeLabel(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  // The institution is in Ghana (UTC), so UTC avoids the server's timezone
  // changing the time printed for a payment.
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function renderCollectionsPrintHtml(data: CollectionsPrintData): string {
  const printedDate = escapeHtml(dateOnlyLabel(data.date));
  const generatedAt = escapeHtml(
    `Generated ${dateOnlyLabel(new Date().toISOString().slice(0, 10))}`,
  );
  const totalPayments = data.payments.length;
  const totalAmount = formatMoney(data.totalAmount);

  const rows = data.payments
    .map(
      (payment, index) => `
      <tr>
        <td class="c-no">${index + 1}</td>
        <td class="c-student-code mono">${escapeHtml(payment.studentCode || '—')}</td>
        <td class="c-student">${escapeHtml(payment.studentName)}</td>
        <td class="c-class">${escapeHtml(payment.className)}</td>
        <td class="c-amount">${escapeHtml(formatMoney(payment.amountPaid))}</td>
        <td class="c-method">${escapeHtml(payment.paymentMethod || '—')}</td>
        <td class="c-allocation">${escapeHtml(payment.allocationTarget || '—')}</td>
        <td class="c-reference mono">${escapeHtml(payment.referenceNo || '—')}</td>
        <td class="c-time">${escapeHtml(timeLabel(payment.dateProcessed))}</td>
      </tr>`,
    )
    .join('');

  const body =
    data.payments.length === 0
      ? '<tr><td colspan="9" class="empty">No payments were recorded on this date.</td></tr>'
      : rows;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment Register — ${printedDate}</title>
  <style>
    @page { size: A4 portrait; margin: 7mm 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #ffffff; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #172341;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .topline { text-align: right; }
    .generated { font-size: 7.5pt; color: #9aa0ae; }

    .logo-frame { display: flex; justify-content: center; }
    .logo-frame img { width: 18mm; height: 18mm; object-fit: contain; }
    .logo-frame.is-missing { display: none; }

    .school {
      margin-top: 1.5mm;
      text-align: center;
      font-size: 16pt;
      font-weight: 700;
      letter-spacing: 1px;
      color: #082a70;
    }
    .school-sub {
      margin-top: 0.8mm;
      text-align: center;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #e4b43c;
    }
    .motto {
      margin-top: 0.5mm;
      text-align: center;
      font-size: 7pt;
      font-style: italic;
      color: #6b7280;
    }

    .rule-navy { margin-top: 2mm; height: 1.8pt; background: #082a70; }
    .rule-gold { margin-top: 2.6pt; height: 0.9pt; background: #e4b43c; }

    .class-title {
      margin-top: 3mm;
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      color: #082a70;
    }
    .class-sub {
      margin-top: 0.8mm;
      text-align: center;
      font-size: 10.5pt;
      font-weight: 700;
      color: #082a70;
    }
    .term {
      margin-top: 1mm;
      text-align: center;
      font-size: 8.5pt;
      color: #6b7280;
    }

    .info-bar {
      display: flex;
      align-items: center;
      margin-top: 3mm;
      border: 0.8pt solid #e6d79f;
      border-radius: 4px;
      background: #fdf8ea;
      padding: 2mm 3.5mm;
      font-size: 8.5pt;
    }
    .info-left { flex: 1 1 50%; }
    .info-right { flex: 1 1 50%; text-align: right; }
    .info-bar .divider { width: 1px; align-self: stretch; background: #e6d79f; }
    .lbl { font-weight: 700; color: #082a70; }
    .info-bar b { font-weight: 700; color: #172341; margin-left: 2mm; }

    table {
      width: 100%;
      margin-top: 3mm;
      border-collapse: collapse;
      table-layout: fixed;
      border-bottom: 1.2pt solid #082a70;
    }
    thead { display: table-header-group; }
    thead th {
      background: #082a70;
      color: #ffffff;
      font-size: 7.5pt;
      font-weight: 700;
      text-align: left;
      padding: 1.8mm 2mm;
      border-bottom: 2.2pt solid #e4b43c;
    }
    th.c-no, td.c-no { width: 4%; text-align: center; }
    th.c-student-code, td.c-student-code { width: 12%; }
    th.c-student, td.c-student { width: 18%; }
    th.c-class, td.c-class { width: 12%; }
    th.c-amount, td.c-amount { width: 10%; text-align: right; white-space: nowrap; }
    th.c-method, td.c-method { width: 10%; }
    th.c-allocation, td.c-allocation { width: 16%; }
    th.c-reference, td.c-reference { width: 11%; }
    th.c-time, td.c-time { width: 7%; text-align: center; }
    td {
      border: 0.4pt solid #d9dde6;
      padding: 1.7mm 2mm;
      font-size: 8pt;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    tr:nth-child(even) td { background: #f6f7f9; }
    tbody tr:last-child td { border-bottom: 1.2pt solid #082a70; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    .mono { font-family: 'Courier New', Courier, monospace; font-size: 7.3pt; color: #3c4256; }
    td.c-no { font-size: 8pt; color: #3c4256; }
    td.empty { text-align: center; font-style: italic; color: #6b7280; padding: 5mm; }

    .signatures {
      margin-top: 9mm;
      page-break-inside: avoid;
      break-inside: avoid;
      font-size: 8.5pt;
      color: #3c4256;
    }
    .sig-row { display: flex; justify-content: space-between; margin-bottom: 8mm; }

    .screen-actions {
      position: absolute;
      top: 0; left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      z-index: 10;
    }
    .screen-actions button {
      border: 0;
      border-radius: 6px;
      background: #082a70;
      color: #fff;
      font: 500 13px/1 'Helvetica Neue', Helvetica, Arial, sans-serif;
      padding: 9px 16px;
      cursor: pointer;
    }
    .screen-actions button.secondary { background: #e5e7eb; color: #172341; }

    @media print {
      .screen-actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="screen-actions" aria-label="Payment register print controls">
    <button type="button" onclick="window.print()">Print payment register</button>
    <button type="button" class="secondary" onclick="window.close()">Close</button>
  </div>

  <div class="topline"><span class="generated">${generatedAt}</span></div>

  <div class="logo-frame" id="school-logo-frame">
    <img id="school-logo" src="/branding/jocomfy-school-logo.png" alt="" width="82" height="82" />
  </div>

  <div class="school">JOCOMFY SCHOOL</div>
  <div class="school-sub">CRECHE &bull; K.G. &bull; PRIMARY &bull; JHS</div>
  <div class="motto">Motto: Knowledge &amp; Wisdom</div>

  <div class="rule-navy"></div>
  <div class="rule-gold"></div>

  <div class="class-title">PAYMENT COLLECTIONS</div>
  <div class="class-sub">Daily Payment Register</div>
  <div class="term">Payments made on ${printedDate}</div>

  <div class="info-bar">
    <div class="info-left"><span class="lbl">Total Payments:</span><b>${totalPayments}</b></div>
    <div class="divider" aria-hidden="true"></div>
    <div class="info-right"><span class="lbl">Total Collected:</span><b>${escapeHtml(totalAmount)}</b></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c-no">NO.</th>
        <th class="c-student-code">STUDENT ID</th>
        <th class="c-student">STUDENT NAME</th>
        <th class="c-class">CLASS</th>
        <th class="c-amount">AMOUNT</th>
        <th class="c-method">METHOD</th>
        <th class="c-allocation">ALLOCATION</th>
        <th class="c-reference">REFERENCE</th>
        <th class="c-time">TIME</th>
      </tr>
    </thead>
    <tbody>${body}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-row">
      <span>Cashier's Signature: ........................................................</span>
      <span>Date: ..................</span>
    </div>
    <div class="sig-row">
      <span>Accountant's Signature: ....................................................</span>
      <span>Verified: ..................</span>
    </div>
  </div>

  <script>
    (function () {
      var LOGO_WAIT_MS = 900;

      function waitForImage(image, timeoutMs) {
        return new Promise(function (resolve) {
          var settled = false;
          function settle() { if (!settled) { settled = true; resolve(); } }
          if (!image) { settle(); return; }
          var timer = window.setTimeout(settle, timeoutMs);
          image.addEventListener("load", function () {
            window.clearTimeout(timer);
            settle();
          }, { once: true });
          image.addEventListener("error", function () {
            window.clearTimeout(timer);
            settle();
          }, { once: true });
        });
      }

      function startPrintFlow() {
        var schoolLogo = document.getElementById("school-logo");
        var schoolLogoFrame = document.getElementById("school-logo-frame");
        if (schoolLogo) {
          if (schoolLogo.complete && !schoolLogo.naturalWidth) {
            if (schoolLogoFrame) schoolLogoFrame.classList.add("is-missing");
          } else {
            schoolLogo.addEventListener("error", function () {
              if (schoolLogoFrame) schoolLogoFrame.classList.add("is-missing");
            }, { once: true });
          }
        }
        waitForImage(schoolLogo, LOGO_WAIT_MS).finally(function () {
          window.setTimeout(function () { window.print(); }, 60);
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
