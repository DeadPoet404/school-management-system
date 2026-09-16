/**
 * SMS-009b — print-ready HTML for the class list.
 *
 * Served by GET /api/students/class-list.print. The page renders the roster
 * in the school's official design (same branding as the receipts) and, once
 * the logo has loaded, opens the browser's NATIVE print dialog on its own —
 * the standard Ctrl+P dialog, which also offers "Save as PDF".
 *
 * Printing is A4 via @page; the table head repeats on every page and rows
 * never split mid-row.
 */
import type { ClassListPdfData } from './pdf';

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateLabel(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function titleCaseTerm(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function renderClassListPrintHtml(data: ClassListPdfData): string {
  const className = escapeHtml(data.className);
  const termLine = escapeHtml(
    `${data.academicYear} Academic Year — ${titleCaseTerm(data.termName)}`,
  );
  const generatedLabel = escapeHtml(`Generated ${dateLabel(data.dateOfIssue)}`);
  const issuedLabel = escapeHtml(dateLabel(data.dateOfIssue));

  const rows = data.students
    .map(
      (s, i) => `
      <tr>
        <td class="c-no">${i + 1}</td>
        <td class="c-name">${escapeHtml(s.name)}</td>
        <td class="c-id mono">${escapeHtml(s.studentId)}</td>
        <td class="c-gender">${escapeHtml(s.gender?.trim() || '—')}</td>
      </tr>`,
    )
    .join('');

  const body =
    data.students.length === 0
      ? `<tr><td colspan="4" class="empty">No active students in this class yet.</td></tr>`
      : rows;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${className} — Class List</title>
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

    .logo-frame { display: flex; justify-content: center; margin-top: 0; }
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
    }
    thead { display: table-header-group; }
    thead th {
      background: #082a70;
      color: #ffffff;
      font-size: 8pt;
      font-weight: 700;
      text-align: left;
      padding: 1.8mm 2.5mm;
      border-bottom: 2.2pt solid #e4b43c;
    }
    th.c-no, td.c-no { width: 11%; text-align: center; }
    th.c-gender, td.c-gender { width: 14%; text-align: center; }
    td {
      border: 0.4pt solid #d9dde6;
      padding: 1.7mm 2.5mm;
      font-size: 9pt;
    }
    tr:nth-child(even) td { background: #f6f7f9; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    .mono { font-family: 'Courier New', Courier, monospace; font-size: 8pt; color: #3c4256; }
    td.c-no { font-size: 9pt; color: #3c4256; }
    td.empty { text-align: center; font-style: italic; color: #6b7280; padding: 5mm; }

    .signatures {
      margin-top: 10mm;
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
  <div class="screen-actions" aria-label="Class list print controls">
    <button type="button" onclick="window.print()">Print class list</button>
    <button type="button" class="secondary" onclick="window.close()">Close</button>
  </div>

  <div class="topline"><span class="generated">${generatedLabel}</span></div>

  <div class="logo-frame" id="school-logo-frame">
    <img id="school-logo" src="/branding/jocomfy-school-logo.png" alt="" width="82" height="82" />
  </div>

  <div class="school">JOCOMFY SCHOOL</div>
  <div class="school-sub">CRECHE &bull; K.G. &bull; PRIMARY &bull; JHS</div>
  <div class="motto">Motto: Knowledge &amp; Wisdom</div>

  <div class="rule-navy"></div>
  <div class="rule-gold"></div>

  <div class="class-title">${className.toUpperCase()}</div>
  <div class="class-sub">Class List</div>
  <div class="term">${termLine}</div>

  <div class="info-bar">
    <div class="info-left"><span class="lbl">Total Students:</span><b>${data.students.length}</b></div>
    <div class="divider" aria-hidden="true"></div>
    <div class="info-right"><span class="lbl">Date:</span><b>${issuedLabel}</b></div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c-no">NO.</th>
        <th>STUDENT NAME</th>
        <th>STUDENT ID</th>
        <th class="c-gender">GENDER</th>
      </tr>
    </thead>
    <tbody>${body}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-row">
      <span>Class Teacher's Signature: ........................................</span>
      <span>Date: ..................</span>
    </div>
    <div class="sig-row">
      <span>Head's Signature: ........................................</span>
      <span>Date: ..................</span>
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

        // Same-origin bundled logo: never gate the print dialog on it. Hide
        // it only if it is already broken or fails to load.
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
