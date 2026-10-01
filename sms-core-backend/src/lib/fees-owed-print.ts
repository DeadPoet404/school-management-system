/**
 * Print-ready HTML for every student who still owes fees.
 * Same letterhead as the class list and the payment register. The amount
 * column is never a dash: a student on this list owes a positive balance,
 * including students who have never made a payment.
 */

export interface FeesOwedPrintRow {
  studentId: string;
  studentName: string;
  className: string;
  guardianPhone: string | null;
  status: string;
  owed: number;
}

export interface FeesOwedPrintData {
  dateOfIssue: Date;
  students: FeesOwedPrintRow[];
  totalOwed: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `₵${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function dateLabel(value: Date): string {
  return `${value.getDate()} ${MONTHS[value.getMonth()]} ${value.getFullYear()}`;
}

export function renderFeesOwedPrintHtml(data: FeesOwedPrintData): string {
  const generatedLabel = escapeHtml(`Generated ${dateLabel(data.dateOfIssue)}`);
  const totalOwed = formatMoney(data.totalOwed);
  const count = data.students.length;

  const rows = data.students
    .map((student, index) => {
      const statusNote = student.status && student.status !== 'ACTIVE'
        ? ` <span class="status">(${escapeHtml(student.status)})</span>`
        : '';
      return `
      <tr>
        <td class="c-no">${index + 1}</td>
        <td class="c-id mono">${escapeHtml(student.studentId)}</td>
        <td class="c-name">${escapeHtml(student.studentName)}${statusNote}</td>
        <td class="c-class">${escapeHtml(student.className || 'Unassigned')}</td>
        <td class="c-phone">${escapeHtml(student.guardianPhone || '')}</td>
        <td class="c-amount">${escapeHtml(formatMoney(student.owed))}</td>
      </tr>`;
    })
    .join('');

  const body = count === 0
    ? '<tr><td colspan="6" class="empty">No students currently owe fees.</td></tr>'
    : rows;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Students Who Owe Fees</title>
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
    .rule-navy { margin-top: 2mm; height: 1.8pt; background: #082a70; }
    .rule-gold { margin-top: 2.6pt; height: 0.9pt; background: #e4b43c; }
    .class-title {
      margin-top: 3mm;
      text-align: center;
      font-size: 14pt;
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
    th.c-no, td.c-no { width: 6%; text-align: center; }
    th.c-id, td.c-id { width: 16%; }
    th.c-name, td.c-name { width: 28%; }
    th.c-class, td.c-class { width: 16%; }
    th.c-phone, td.c-phone { width: 18%; }
    th.c-amount, td.c-amount { width: 16%; text-align: right; white-space: nowrap; font-weight: 700; }
    td {
      border: 0.4pt solid #d9dde6;
      padding: 1.6mm 2mm;
      font-size: 8pt;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    tr:nth-child(even) td { background: #f6f7f9; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    .mono { font-family: 'Courier New', Courier, monospace; font-size: 7.3pt; color: #3c4256; }
    .status { font-size: 7pt; color: #9aa0ae; font-weight: 600; }
    .empty { text-align: center; padding: 8mm; color: #6b7280; }
    .total-row td {
      background: #fdf8ea !important;
      border-top: 1.2pt solid #082a70;
      font-weight: 700;
      color: #082a70;
    }
    .signatures {
      margin-top: 10mm;
      page-break-inside: avoid;
      break-inside: avoid;
      font-size: 8.5pt;
      color: #3c4256;
    }
    .sig-row { display: flex; justify-content: space-between; margin-bottom: 8mm; }
    .screen-actions {
      position: sticky;
      top: 0;
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 10px 0 6px;
      background: #ffffff;
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
  <div class="screen-actions" aria-label="Fees owed print controls">
    <button type="button" onclick="window.print()">Print</button>
    <button type="button" class="secondary" onclick="window.close()">Close</button>
  </div>
  <div class="topline"><span class="generated">${generatedLabel}</span></div>
  <div class="logo-frame" id="school-logo-frame">
    <img id="school-logo" src="/branding/jocomfy-school-logo.png" alt="" width="82" height="82" />
  </div>
  <div class="school">JOCOMFY SCHOOL</div>
  <div class="school-sub">FEES OWED</div>
  <div class="rule-navy"></div>
  <div class="rule-gold"></div>
  <div class="class-title">Students Who Owe Fees</div>
  <div class="term">Amount owed is shown even when the student has not yet paid.</div>
  <div class="info-bar">
    <div class="info-left"><span class="lbl">Students</span><b>${count}</b></div>
    <div class="divider"></div>
    <div class="info-right"><span class="lbl">Total owed</span><b>${escapeHtml(totalOwed)}</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c-no">NO.</th>
        <th class="c-id">STUDENT ID</th>
        <th class="c-name">STUDENT NAME</th>
        <th class="c-class">CLASS</th>
        <th class="c-phone">GUARDIAN PHONE</th>
        <th class="c-amount">FEES OWED</th>
      </tr>
    </thead>
    <tbody>
      ${body}
      <tr class="total-row">
        <td class="c-no"></td>
        <td class="c-id"></td>
        <td class="c-name">TOTAL</td>
        <td class="c-class"></td>
        <td class="c-phone">${count} student${count === 1 ? '' : 's'}</td>
        <td class="c-amount">${escapeHtml(totalOwed)}</td>
      </tr>
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-row">
      <span>Accountant's Signature: ....................................................</span>
      <span>Date: ..................</span>
    </div>
    <div class="sig-row">
      <span>Head's Signature: ..............................................................</span>
      <span>Date: ..................</span>
    </div>
  </div>

  <script>
    (function () {
      function startPrintFlow() {
        var schoolLogo = document.getElementById("school-logo");
        var schoolLogoFrame = document.getElementById("school-logo-frame");
        function go() { window.setTimeout(function () { window.print(); }, 60); }
        if (!schoolLogo) { go(); return; }
        if (schoolLogo.complete) {
          if (!schoolLogo.naturalWidth && schoolLogoFrame) schoolLogoFrame.classList.add("is-missing");
          go();
          return;
        }
        var timer = window.setTimeout(go, 900);
        schoolLogo.addEventListener("load", function () { window.clearTimeout(timer); go(); }, { once: true });
        schoolLogo.addEventListener("error", function () {
          window.clearTimeout(timer);
          if (schoolLogoFrame) schoolLogoFrame.classList.add("is-missing");
          go();
        }, { once: true });
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
