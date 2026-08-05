/**
 * SMS-007 -- PDFKit renderer for official cash-payment receipts.
 *
 * Buffer-first by design: the finance controller streams the buffer over HTTP
 * today; the SMS-006 mailer attaches the IDENTICAL buffer to receipt emails.
 * Receipts render on demand from live ledger data -- no stored blobs.
 */
import PDFDocument from 'pdfkit';
import { amountInWords } from './amount-in-words';

export interface ReceiptPdfData {
  receiptNumber: string;
  dateProcessed: Date | string;
  studentName: string;
  studentCode: string | null;   // e.g. HHA-2024-0001 (null when never linked)
  className: string | null;
  amountPaid: number;
  paymentMethod: string;        // 'CASH' per the SMS-002 contract
  referenceNo: string;
  allocationTarget: string;
  outstandingBalance: number | null;  // live ledger balance; null without a linked student
}

export interface RenderOptions {
  /** Disable deflate so tests can grep literal strings in the content stream. */
  compress?: boolean;
}

function formatMoney(n: number): string {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function renderReceiptPdf(data: ReceiptPdfData, opts: RenderOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 32, compress: opts.compress ?? true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.info.Title = `Receipt ${data.receiptNumber}`;
    // Searchable metadata channel (Info dict is stored as literal strings;
    // the content stream itself is glyph-encoded by modern pdfkit).
    doc.info.Subject = `OFFICIAL PAYMENT RECEIPT - ${data.studentName} - ${data.paymentMethod}`;
    doc.info.Keywords = amountInWords(data.amountPaid);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Letterhead ──
    doc.fontSize(15).font('Helvetica-Bold').fillColor('#1a1a1a')
      .text('SCHOOL MANAGEMENT SYSTEM', { align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#555555')
      .text('Institutional Collections & Receipting Office', { align: 'center' });
    doc.moveDown(0.4);
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1).strokeColor('#999999').stroke();
    doc.moveDown(0.7);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
      .text('OFFICIAL PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.9);

    // ── Receipt meta (two columns) ──
    const metaY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').text(`Receipt No: ${data.receiptNumber}`, left, metaY);
    doc.font('Helvetica')
      .text(`Date Issued: ${formatDate(data.dateProcessed)}`, left + width - 170, metaY, { width: 170, align: 'right' });
    doc.moveDown(0.9);

    // ── Student block ──
    doc.fontSize(9).font('Helvetica');
    doc.text(`Student: ${data.studentName}`, left);
    doc.text(`Student ID: ${data.studentCode ?? 'Not linked (walk-in entry)'}`, left);
    doc.text(`Class: ${data.className ?? 'N/A'}`, left);
    doc.moveDown(0.8);

    // ── Amount figures + words ──
    doc.fontSize(12).font('Helvetica-Bold')
      .text(`AMOUNT PAID: GHS ${formatMoney(data.amountPaid)}`, left);
    doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#333333')
      .text(amountInWords(data.amountPaid), left, doc.y, { width });
    doc.fillColor('#000000').moveDown(0.6);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Payment Method: ${data.paymentMethod}`, left);
    doc.text(`Reference: ${data.referenceNo}`, left);
    doc.moveDown(0.8);

    // ── Allocation table ──
    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Allocation Target', left, tableTop, { width: width - 90 });
    doc.text('Amount (GHS)', left + width - 90, tableTop, { width: 90, align: 'right' });
    doc.moveTo(left, tableTop + 12).lineTo(left + width, tableTop + 12).lineWidth(0.7).strokeColor('#666666').stroke();
    doc.font('Helvetica');
    doc.text(data.allocationTarget, left, tableTop + 16, { width: width - 90 });
    doc.text(formatMoney(data.amountPaid), left + width - 90, tableTop + 16, { width: 90, align: 'right' });
    const rowHeight = Math.max(14, doc.heightOfString(data.allocationTarget, { width: width - 90 }) + 4);
    doc.moveTo(left, tableTop + 16 + rowHeight).lineTo(left + width, tableTop + 16 + rowHeight)
      .lineWidth(0.4).strokeColor('#cccccc').stroke();
    doc.y = tableTop + 16 + rowHeight + 10;

    // ── Outstanding balance (live ledger read at print time) ──
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text(
      data.outstandingBalance === null
        ? 'Current Outstanding Balance: N/A (no linked student ledger)'
        : `Current Outstanding Balance: GHS ${formatMoney(data.outstandingBalance)}`,
      left,
    );
    doc.moveDown(2);

    // ── Receipt authority lines ──
    doc.fontSize(9).font('Helvetica');
    doc.text('Received by: ______________________________', left);
    doc.moveDown(1.2);
    doc.text('Signature & Stamp: ________________________', left);

    // ── Footer ──
    doc.fontSize(7).fillColor('#777777').text(
      `Generated on demand from live ledger data -- ${new Date().toISOString()}`,
      left,
      doc.page.height - doc.page.margins.bottom - 26,
      { width, align: 'center' },
    );

    doc.end();
  });
}


// ── SMS-008: cumulative transcript renderer (A4, multi-page) ─────────────────

export interface TranscriptRow {
  subject: string;
  code: string;
  caScore: number;
  examScore: number;
  finalScore: number;
  letterGrade: string;
  gradePoints: number;
  creditHours: number;
}

export interface TranscriptTermSection {
  termName: string;
  academicYear: string;
  rows: TranscriptRow[];
  termGpa: number;
  creditHours: number;
}

export interface TranscriptPdfData {
  studentName: string;
  studentCode: string;
  className: string | null;
  enrollmentDate: Date | string;
  dateOfIssue: Date | string;
  terms: TranscriptTermSection[];
  cumulativeGpa: number | null;
}

interface TranscriptColumn {
  label: string;
  x: number;
  w: number;
  align: 'left' | 'right';
}

export function renderTranscriptPdf(data: TranscriptPdfData, opts: RenderOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 32, compress: opts.compress ?? true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.info.Title = `Transcript ${data.studentCode}`;
    doc.info.Subject = `OFFICIAL ACADEMIC TRANSCRIPT - ${data.studentName}`;
    doc.info.Keywords = `transcript,${data.studentCode},terms:${data.terms.length}`;

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const generatedAt = new Date(data.dateOfIssue).toISOString();

    // Backlog: "Official transcript — generated {date}" footer on EVERY page.
    const drawFooter = () => {
      doc.fontSize(7).fillColor('#777777').text(
        `Official transcript — generated ${generatedAt} — ${data.studentCode}`,
        left,
        doc.page.height - doc.page.margins.bottom - 18,
        { width, align: 'center' },
      );
    };
    doc.on('pageAdded', drawFooter);

    const ensureSpace = (height: number) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 42 - height) doc.addPage();
    };

    // ── Letterhead ──
    doc.fontSize(15).font('Helvetica-Bold').fillColor('#1a1a1a')
      .text('SCHOOL MANAGEMENT SYSTEM', { align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#555555')
      .text('Office of the Registrar — Academic Records', { align: 'center' });
    doc.moveDown(0.4);
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1).strokeColor('#999999').stroke();
    doc.moveDown(0.7);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
      .text('OFFICIAL ACADEMIC TRANSCRIPT', { align: 'center' });
    doc.moveDown(0.9);

    // ── Student identity block (two columns) ──
    const idBlockY = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Student: ${data.studentName}`, left, idBlockY);
    doc.text(`Student ID: ${data.studentCode}`, left);
    doc.text(`Class: ${data.className ?? 'N/A'}`, left);
    const rightX = left + width - 190;
    doc.text(`Enrollment Date: ${new Date(data.enrollmentDate).toISOString().slice(0, 10)}`, rightX, idBlockY, { width: 190, align: 'right' });
    doc.text(`Date of Issue: ${new Date(data.dateOfIssue).toISOString().slice(0, 10)}`, rightX, doc.y, { width: 190, align: 'right' });
    doc.x = left;
    doc.moveDown(1.0);

    if (data.terms.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique')
        .text('No grade records on file for this student yet.', { align: 'center' });
      doc.moveDown(1);
    }

    const columns: TranscriptColumn[] = [
      { label: 'Subject', x: left, w: 150, align: 'left' },
      { label: 'Code', x: left + 150, w: 55, align: 'left' },
      { label: 'CA', x: left + 205, w: 50, align: 'right' },
      { label: 'Exam', x: left + 255, w: 50, align: 'right' },
      { label: 'Score', x: left + 305, w: 55, align: 'right' },
      { label: 'Grade', x: left + 360, w: 45, align: 'right' },
      { label: 'Credits', x: left + 405, w: 55, align: 'right' },
      { label: 'Points', x: left + 460, w: width - 460, align: 'right' },
    ];

    for (const term of data.terms) {
      ensureSpace(96);
      // Term band
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000')
        .text(`${term.termName} — Academic Year ${term.academicYear}`, left);
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.7).strokeColor('#666666').stroke();
      doc.moveDown(0.3);
      // Column headers
      const headerY = doc.y;
      doc.fontSize(8).font('Helvetica-Bold');
      for (const col of columns) {
        doc.text(col.label, col.x, headerY, { width: col.w, align: col.align });
      }
      doc.y = headerY + 12;

      doc.fontSize(8.5).font('Helvetica');
      for (const row of term.rows) {
        ensureSpace(26);
        const y = doc.y;
        doc.text(row.subject, columns[0]!.x, y, { width: columns[0]!.w });
        doc.text(row.code, columns[1]!.x, y, { width: columns[1]!.w });
        doc.text(row.caScore.toFixed(1), columns[2]!.x, y, { width: columns[2]!.w, align: 'right' });
        doc.text(row.examScore.toFixed(1), columns[3]!.x, y, { width: columns[3]!.w, align: 'right' });
        doc.text(row.finalScore.toFixed(1), columns[4]!.x, y, { width: columns[4]!.w, align: 'right' });
        doc.text(row.letterGrade, columns[5]!.x, y, { width: columns[5]!.w, align: 'right' });
        doc.text(String(row.creditHours), columns[6]!.x, y, { width: columns[6]!.w, align: 'right' });
        doc.text(row.gradePoints.toFixed(2), columns[7]!.x, y, { width: columns[7]!.w, align: 'right' });
        doc.y = y + 12;
      }

      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.4).strokeColor('#cccccc').stroke();
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold')
        .text(`Term GPA: ${term.termGpa.toFixed(2)}     Credit Hours: ${term.creditHours}`, left, doc.y, { align: 'right', width });
      doc.moveDown(0.9);
    }

    // ── Cumulative block ──
    ensureSpace(70);
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1).strokeColor('#1a1a1a').stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(
      data.cumulativeGpa === null
        ? 'CUMULATIVE GPA: N/A (no grade records)'
        : `CUMULATIVE GPA: ${data.cumulativeGpa.toFixed(2)}`,
      left,
      doc.y,
      { width, align: 'center' },
    );
    doc.moveDown(1.4);

    // ── Remarks + signature/stamp ──
    ensureSpace(80);
    doc.fontSize(9).font('Helvetica');
    doc.text('Remarks: ______________________________________________________________________', left);
    doc.moveDown(0.9);
    doc.text('Remarks: ______________________________________________________________________', left);
    doc.moveDown(1.6);
    doc.text('Registrar: ______________________          Signature & Stamp: ______________________', left);

    drawFooter();
    doc.end();
  });
}

