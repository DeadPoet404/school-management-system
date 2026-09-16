/**
 * SMS-007 -- PDFKit renderer for official payment receipts.
 *
 * Receipts render on demand from live ledger data. The same PDF buffer is
 * streamed by the finance endpoint and attached to collection receipt emails.
 *
 * A PDF has a fixed physical page size once generated, so print fidelity is
 * achieved with intentional A5 and A4 layouts rather than browser scaling.
 */
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { amountInWords } from './amount-in-words';

type ReceiptDocument = InstanceType<typeof PDFDocument>;

export const RECEIPT_PAPER_SIZES = ['A5', 'A4'] as const;

export type ReceiptPaperSize = (typeof RECEIPT_PAPER_SIZES)[number];

export interface ReceiptInstitution {
  schoolName?: string | null;
  schoolCode?: string | null;
  motto?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  currency?: string | null;
}

export interface ReceiptPdfData {
  receiptNumber: string;
  dateProcessed: Date | string;
  studentName: string;
  studentCode: string | null;
  className: string | null;
  amountPaid: number;
  paymentMethod: string;
  referenceNo: string;
  allocationTarget: string;
  outstandingBalance: number | null;
  institution?: ReceiptInstitution | null;
}

export interface RenderOptions {
  /** Disable deflate so tests can inspect document metadata. */
  compress?: boolean;
  /** A5 is the compact receipt default; A4 is the office-printer alternative. */
  paperSize?: ReceiptPaperSize;
}

interface ReceiptLayout {
  paperSize: ReceiptPaperSize;
  margin: number;
  titleSize: number;
  studentNameSize: number;
  headingSize: number;
  bodySize: number;
  smallSize: number;
  sectionGap: number;
  summaryRowHeight: number;
  footerReserve: number;
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

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveReceiptPaperSize(
  value: string | null | undefined,
): ReceiptPaperSize {
  return value === 'A4' ? 'A4' : 'A5';
}

function getReceiptLayout(paperSize: ReceiptPaperSize): ReceiptLayout {
  if (paperSize === 'A4') {
    return {
      paperSize,
      margin: 48,
      titleSize: 23,
      studentNameSize: 18,
      headingSize: 12,
      bodySize: 10,
      smallSize: 8,
      sectionGap: 28,
      summaryRowHeight: 23,
      footerReserve: 170,
    };
  }

  return {
    paperSize,
    margin: 31,
    titleSize: 17,
    studentNameSize: 14,
    headingSize: 10,
    bodySize: 8.5,
    smallSize: 7,
    sectionGap: 20,
    summaryRowHeight: 18,
    footerReserve: 132,
  };
}

function schoolIdentity(institution?: ReceiptInstitution | null) {
  const schoolName =
    nonEmpty(institution?.schoolName) ?? 'School Management System';
  const schoolCode = nonEmpty(institution?.schoolCode);
  const motto = nonEmpty(institution?.motto);
  const address = nonEmpty(institution?.address);
  const phone = nonEmpty(institution?.phone);
  const email = nonEmpty(institution?.email);

  const detailLines = [
    schoolCode ? `School code: ${schoolCode}` : null,
    motto,
    address,
    [phone, email].filter(Boolean).join('  |  ') || null,
  ].filter((line): line is string => Boolean(line));

  return { schoolName, detailLines };
}

function drawRule(
  doc: ReceiptDocument,
  x: number,
  y: number,
  width: number,
  lineWidth = 0.55,
  color = '#1A1A1A',
): void {
  doc
    .moveTo(x, y)
    .lineTo(x + width, y)
    .lineWidth(lineWidth)
    .strokeColor(color)
    .stroke();
}

function drawSummaryRow(
  doc: ReceiptDocument,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  fontSize: number,
  isEmphasized = false,
): void {
  const valueWidth = width * 0.43;
  const labelWidth = width - valueWidth - 8;

  doc
    .font(isEmphasized ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fontSize)
    .fillColor('#171717')
    .text(label, x, y, { width: labelWidth });

  doc
    .font(isEmphasized ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fontSize)
    .fillColor('#171717')
    .text(value, x + width - valueWidth, y, {
      width: valueWidth,
      align: 'right',
    });
}

function ensureFooterSpace(
  doc: ReceiptDocument,
  currentY: number,
  requiredHeight: number,
  layout: ReceiptLayout,
): number {
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  if (currentY + requiredHeight <= pageBottom) {
    return currentY;
  }

  doc.addPage({
    size: layout.paperSize,
    margin: layout.margin,
  });

  return doc.page.margins.top;
}

export function renderReceiptPdf(
  data: ReceiptPdfData,
  options: RenderOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const paperSize = options.paperSize ?? 'A5';
    const layout = getReceiptLayout(paperSize);
    const doc = new PDFDocument({
      size: paperSize,
      margin: layout.margin,
      compress: options.compress ?? true,
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const institution = schoolIdentity(data.institution);
    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const width =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const right = left + width;
    const identityWidth = width * 0.47;
    const schoolWidth = width * 0.43;
    const schoolX = right - schoolWidth;

    doc.info.Title = `Payment Receipt ${data.receiptNumber}`;
    doc.info.Subject =
      `PAYMENT RECEIPT - ${institution.schoolName} - ${data.studentName} - ${data.paymentMethod}`;
    doc.info.Keywords =
      `receipt,paper:${paperSize},${amountInWords(data.amountPaid)}`;

    // ── Upper identity block ─────────────────────────────────────────────
    let studentY = top;

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.studentNameSize)
      .fillColor('#111111')
      .text(data.studentName, left, studentY, {
        width: identityWidth,
        lineGap: layout.paperSize === 'A4' ? 1 : 0,
      });

    studentY +=
      doc.heightOfString(data.studentName, { width: identityWidth }) + 8;

    const studentDetails = [
      `Student ID  ${data.studentCode ?? 'Walk-in collection'}`,
      `Class  ${data.className ?? 'Not linked to a class'}`,
      `Payment date  ${formatDate(data.dateProcessed)}`,
    ];

    doc
      .font('Helvetica')
      .fontSize(layout.bodySize)
      .fillColor('#222222')
      .text(studentDetails.join('\n'), left, studentY, {
        width: identityWidth,
        lineGap: layout.paperSize === 'A4' ? 3 : 2,
      });

    const studentBottom =
      studentY +
      doc.heightOfString(studentDetails.join('\n'), {
        width: identityWidth,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.titleSize)
      .fillColor('#111111')
      .text('PAYMENT\nRECEIPT', schoolX, top, {
        width: schoolWidth,
        align: 'right',
        lineGap: layout.paperSize === 'A4' ? -1 : -2,
      });

    const titleHeight = doc.heightOfString('PAYMENT\nRECEIPT', {
      width: schoolWidth,
    });
    let schoolY = top + titleHeight + 8;

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.bodySize)
      .fillColor('#171717')
      .text(institution.schoolName, schoolX, schoolY, {
        width: schoolWidth,
        align: 'right',
      });

    schoolY +=
      doc.heightOfString(institution.schoolName, {
        width: schoolWidth,
      }) + 4;

    if (institution.detailLines.length > 0) {
      const schoolDetails = institution.detailLines.join('\n');

      doc
        .font('Helvetica')
        .fontSize(layout.smallSize)
        .fillColor('#333333')
        .text(schoolDetails, schoolX, schoolY, {
          width: schoolWidth,
          align: 'right',
          lineGap: layout.paperSize === 'A4' ? 2 : 1,
        });

      schoolY += doc.heightOfString(schoolDetails, {
        width: schoolWidth,
      });
    }

    schoolY += 8;

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.smallSize)
      .fillColor('#171717')
      .text(`Receipt no.  ${data.receiptNumber}`, schoolX, schoolY, {
        width: schoolWidth,
        align: 'right',
      });

    const headerBottom = Math.max(studentBottom, schoolY + 12);
    const detailsHeadingY = headerBottom + layout.sectionGap;

    // ── Collection line item ─────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(layout.headingSize)
      .fillColor('#111111')
      .text('PAYMENT DETAILS', left, detailsHeadingY);

    const detailsRuleY = detailsHeadingY + layout.headingSize + 6;
    drawRule(doc, left, detailsRuleY, width, 0.7);

    const allocationY = detailsRuleY + 12;
    const allocationWidth = width * 0.66;
    const amountWidth = width - allocationWidth - 12;

    doc
      .font('Helvetica')
      .fontSize(layout.bodySize)
      .fillColor('#171717')
      .text(data.allocationTarget, left, allocationY, {
        width: allocationWidth,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.bodySize)
      .fillColor('#171717')
      .text(`GHS ${formatMoney(data.amountPaid)}`, right - amountWidth, allocationY, {
        width: amountWidth,
        align: 'right',
      });

    const allocationHeight = Math.max(
      doc.heightOfString(data.allocationTarget, { width: allocationWidth }),
      doc.heightOfString(`GHS ${formatMoney(data.amountPaid)}`, {
        width: amountWidth,
      }),
    );

    const allocationBottom = allocationY + allocationHeight + 10;
    drawRule(doc, left, allocationBottom, width, 0.4, '#8A8A8A');

    const paymentMetaY = allocationBottom + 10;
    const paymentMeta = [
      `Method  ${data.paymentMethod}`,
      `Reference  ${data.referenceNo}`,
    ].join('\n');
    const paymentMetaWidth = width;

    doc
      .font('Helvetica')
      .fontSize(layout.smallSize)
      .fillColor('#333333')
      .text(paymentMeta, left, paymentMetaY, {
        width: paymentMetaWidth,
        lineGap: layout.paperSize === 'A4' ? 2 : 1,
      });

    const paymentMetaHeight = doc.heightOfString(paymentMeta, {
      width: paymentMetaWidth,
    });

    // ── Amount words and financial summary ───────────────────────────────
    // The payment metadata occupies its own row. Keeping the summary below it
    // prevents the amount-in-words block from colliding with method/reference.
    const summaryX = left + width * 0.52;
    const summaryWidth = right - summaryX;
    const summaryY = paymentMetaY + paymentMetaHeight + 16;
    const wordsWidth = summaryX - left - 18;

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.smallSize)
      .fillColor('#4A4A4A')
      .text('AMOUNT IN WORDS', left, summaryY + 2, {
        width: wordsWidth,
      });

    const wordsY = summaryY + layout.smallSize + 7;
    const amountWords = amountInWords(data.amountPaid);

    doc
      .font('Helvetica-Oblique')
      .fontSize(layout.smallSize)
      .fillColor('#222222')
      .text(amountWords, left, wordsY, {
        width: wordsWidth,
      });

    const wordsBottom =
      wordsY + doc.heightOfString(amountWords, { width: wordsWidth });

    drawRule(doc, summaryX, summaryY, summaryWidth, 0.55);

    drawSummaryRow(
      doc,
      summaryX,
      summaryY + 8,
      summaryWidth,
      'AMOUNT RECEIVED',
      `GHS ${formatMoney(data.amountPaid)}`,
      layout.bodySize,
      true,
    );

    drawSummaryRow(
      doc,
      summaryX,
      summaryY + 8 + layout.summaryRowHeight,
      summaryWidth,
      'OUTSTANDING BALANCE',
      data.outstandingBalance === null
        ? 'N/A'
        : `GHS ${formatMoney(data.outstandingBalance)}`,
      layout.bodySize,
      false,
    );

    const summaryBottom = summaryY + 8 + layout.summaryRowHeight * 2 + 5;
    drawRule(doc, summaryX, summaryBottom, summaryWidth, 0.7);

    let footerY = Math.max(
      wordsBottom,
      summaryBottom,
      paymentMetaY + doc.heightOfString(paymentMeta, { width: width * 0.56 }),
    ) + layout.sectionGap;

    // ── Lower reference-style information columns ───────────────────────
    const lowerGap = layout.paperSize === 'A4' ? 34 : 22;
    const lowerColumnWidth = (width - lowerGap) / 2;
    const terms =
      'This official receipt confirms that the payment above was received and allocated to the stated purpose. Keep it for your school records.';

    const schoolDetails =
      institution.detailLines.length > 0
        ? institution.detailLines.join('\n')
        : 'School details are maintained in the system setup profile.';

    doc.font('Helvetica').fontSize(layout.smallSize);
    const lowerContentHeight = Math.max(
      doc.heightOfString(schoolDetails, { width: lowerColumnWidth }),
      doc.heightOfString(terms, { width: lowerColumnWidth }),
    );
    const lowerBlockHeight =
      layout.headingSize + 10 + lowerContentHeight + 20 + layout.bodySize + 28;

    footerY = ensureFooterSpace(
      doc,
      footerY,
      lowerBlockHeight + layout.footerReserve,
      layout,
    );

    drawRule(doc, left, footerY, width, 0.55, '#5B5B5B');

    const lowerHeadingY = footerY + 11;
    const termsX = left + lowerColumnWidth + lowerGap;

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.headingSize)
      .fillColor('#171717')
      .text('SCHOOL DETAILS', left, lowerHeadingY, {
        width: lowerColumnWidth,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.headingSize)
      .fillColor('#171717')
      .text('RECEIPT TERMS', termsX, lowerHeadingY, {
        width: lowerColumnWidth,
      });

    const lowerContentY = lowerHeadingY + layout.headingSize + 8;

    doc
      .font('Helvetica')
      .fontSize(layout.smallSize)
      .fillColor('#222222')
      .text(schoolDetails, left, lowerContentY, {
        width: lowerColumnWidth,
        lineGap: layout.paperSize === 'A4' ? 2 : 1,
      });

    doc
      .font('Helvetica')
      .fontSize(layout.smallSize)
      .fillColor('#222222')
      .text(terms, termsX, lowerContentY, {
        width: lowerColumnWidth,
        lineGap: layout.paperSize === 'A4' ? 2 : 1,
      });

    const lowerBottom =
      lowerContentY +
      Math.max(
        doc.heightOfString(schoolDetails, { width: lowerColumnWidth }),
        doc.heightOfString(terms, { width: lowerColumnWidth }),
      ) +
      24;

    drawRule(doc, left, lowerBottom, width, 0.55, '#5B5B5B');

    const signatureY = lowerBottom + 14;
    const signatureWidth = (width - lowerGap) / 2;

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.smallSize)
      .fillColor('#171717')
      .text('RECEIVED BY', left, signatureY, { width: signatureWidth });

    doc
      .font('Helvetica-Bold')
      .fontSize(layout.smallSize)
      .fillColor('#171717')
      .text('SIGNATURE & STAMP', left + signatureWidth + lowerGap, signatureY, {
        width: signatureWidth,
      });

    const signatureLineY = signatureY + layout.smallSize + 18;
    drawRule(doc, left, signatureLineY, signatureWidth, 0.45, '#555555');
    drawRule(
      doc,
      left + signatureWidth + lowerGap,
      signatureLineY,
      signatureWidth,
      0.45,
      '#555555',
    );

    doc
      .font('Helvetica')
      .fontSize(layout.smallSize - 0.5)
      .fillColor('#666666')
      .text(
        `Official receipt - generated ${new Date().toISOString()}`,
        left,
        doc.page.height - doc.page.margins.bottom - 12,
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


// ── SMS-009: class list renderer (A4, multi-page) ───────────────────────────
//
// Print-ready class roster matching the school's official design:
// logo + wordmark header, double rule, gold info bar, navy table head,
// zebra rows, signature block, and a page footer on every page.

export interface ClassListStudentRow {
  name: string;
  studentId: string;
  gender: string | null;
}

export interface ClassListPdfData {
  className: string;
  termName: string;
  academicYear: string;
  dateOfIssue: Date | string;
  /** Active students of the class, sorted A–Z by name. */
  students: ClassListStudentRow[];
}

const CLASS_LIST_BRAND = {
  navy: '#082a70',
  gold: '#e4b43c',
  ink: '#172341',
  zebra: '#f6f7f9',
  rule: '#d9dde6',
  muted: '#6b7280',
  faint: '#9aa0ae',
  cream: '#fdf8ea',
  creamBorder: '#e6d79f',
};

let classListLogoCache: Buffer | null | undefined;
function loadClassListLogo(): Buffer | null {
  if (classListLogoCache !== undefined) return classListLogoCache;
  try {
    classListLogoCache = fs.readFileSync(
      path.join(__dirname, '..', 'assets', 'jocomfy-school-logo.png'),
    );
  } catch {
    // Branding asset missing from the build: render without the crest
    // rather than failing the whole print.
    classListLogoCache = null;
  }
  return classListLogoCache;
}

const CLASS_LIST_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function classListDateLabel(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${CLASS_LIST_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 'FIRST TERM' -> 'First Term' (keeps the PDF title case, as printed). */
export function titleCaseTerm(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function renderClassListPdf(
  data: ClassListPdfData,
  opts: RenderOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, compress: opts.compress ?? true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ASCII-only metadata: non-ASCII characters make pdfkit emit UTF-16BE
    // strings that search tooling (and tests) cannot match.
    doc.info.Title = `Class List - ${data.className}`;
    doc.info.Subject = `JOCOMFY SCHOOL - ${data.className} Class List - ${data.academicYear} ${data.termName}`;
    doc.info.Keywords = `class-list,${data.className},students:${data.students.length}`;

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottom = doc.page.height - doc.page.margins.bottom;
    const generatedLabel = `Generated ${classListDateLabel(data.dateOfIssue)}`;
    const dateLabel = classListDateLabel(data.dateOfIssue);
    const termLine = `${data.academicYear} Academic Year — ${titleCaseTerm(data.termName)}`;
    let page = 0;

    // ── Footer: hairline + brand / class / page, on every page. ──
    // NOTE 1: text must stay ABOVE the bottom margin — text below it makes
    // pdfkit's line wrapper keep adding pages (infinite recursion).
    // NOTE 2: 'pageAdded' fires during construction for page 1, before any
    // listener exists, so the footer is drawn manually too (idempotent per
    // page object).
    const footerDrawnPages = new Set<object>();
    const drawFooter = () => {
      if (footerDrawnPages.has(doc.page)) return;
      footerDrawnPages.add(doc.page);
      page += 1;
      const y = bottom - 16;
      doc.save();
      doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor('#e3e5ea').stroke();
      doc.fontSize(7.5).font('Helvetica').fillColor(CLASS_LIST_BRAND.faint);
      doc.text('Jocomfy School  •  Knowledge & Wisdom', left, y + 5, { width: 200, lineBreak: false });
      doc.text(`${data.className}  •  ${data.students.length} students`, left, y + 5, {
        width,
        align: 'center',
        lineBreak: false,
      });
      doc.text(`Page ${page}`, left + width - 120, y + 5, { width: 120, align: 'right', lineBreak: false });
      doc.restore();
    };
    doc.on('pageAdded', drawFooter);

    // ── Table columns ──
    const colNo = 46;
    const colName = 262;
    const colId = 128;
    const colGender = width - colNo - colName - colId;
    const xName = left + colNo;
    const xId = xName + colName;
    const xGender = xId + colId;
    const rowHeight = 24;

    const drawTableHead = (y: number) => {
      doc.save();
      doc.rect(left, y, width, 22).fill(CLASS_LIST_BRAND.navy);
      doc.rect(left, y + 22, width, 2.2).fill(CLASS_LIST_BRAND.gold);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('NO.', left, y + 7.5, { width: colNo, align: 'center', lineBreak: false });
      doc.text('STUDENT NAME', xName + 8, y + 7.5, { width: colName - 16, lineBreak: false });
      doc.text('STUDENT ID', xId + 8, y + 7.5, { width: colId - 16, lineBreak: false });
      doc.text('GENDER', xGender, y + 7.5, { width: colGender, align: 'center', lineBreak: false });
      doc.restore();
      return y + 24.2;
    };

    // ── Page-1 letterhead ──
    doc.fontSize(7.5).font('Helvetica').fillColor(CLASS_LIST_BRAND.faint)
      .text(generatedLabel, left, 22, { width, align: 'right', lineBreak: false });

    const logo = loadClassListLogo();
    let y = 32;
    if (logo) {
      const logoSize = 82;
      doc.image(logo, (doc.page.width - logoSize) / 2, y, { width: logoSize, height: logoSize });
      y += logoSize + 10;
    }

    doc.fontSize(20).font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.navy)
      .text('JOCOMFY SCHOOL', left, y, { width, align: 'center', lineBreak: false });
    y += 22;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.gold)
      .text('CRECHE  •  K.G.  •  PRIMARY  •  JHS', left, y, { width, align: 'center', lineBreak: false });
    y += 12;
    doc.fontSize(8).font('Helvetica-Oblique').fillColor(CLASS_LIST_BRAND.muted)
      .text('Motto: Knowledge & Wisdom', left, y, { width, align: 'center', lineBreak: false });
    y += 12;

    // Double rule: navy over gold.
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.8).strokeColor(CLASS_LIST_BRAND.navy).stroke();
    doc.moveTo(left, y + 2.6).lineTo(left + width, y + 2.6).lineWidth(0.9).strokeColor(CLASS_LIST_BRAND.gold).stroke();
    y += 20;

    doc.fontSize(17).font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.navy)
      .text(data.className.toUpperCase(), left, y, { width, align: 'center', lineBreak: false });
    y += 20;
    doc.fontSize(12).font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.navy)
      .text('Class List', left, y, { width, align: 'center', lineBreak: false });
    y += 15;
    doc.fontSize(9.5).font('Helvetica').fillColor(CLASS_LIST_BRAND.muted)
      .text(termLine, left, y, { width, align: 'center', lineBreak: false });
    y += 14;

    // ── Info bar: cream rounded box, total + date ──
    const barH = 26;
    doc.save();
    doc.lineWidth(0.8);
    doc.roundedRect(left, y, width, barH, 4).fillAndStroke(CLASS_LIST_BRAND.cream, CLASS_LIST_BRAND.creamBorder);
    doc.moveTo(left + width / 2, y + 5).lineTo(left + width / 2, y + barH - 5).lineWidth(0.6).strokeColor(CLASS_LIST_BRAND.creamBorder).stroke();
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(CLASS_LIST_BRAND.navy);
    doc.text('Total Students:', left + 12, y + 8.5, { continued: false, lineBreak: false });
    const totalW = doc.widthOfString('Total Students:');
    doc.font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.ink)
      .text(String(data.students.length), left + 12 + totalW + 4, y + 8.5, { lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.navy)
      .text('Date:', left + width - 190, y + 8.5, { width: 86, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.ink)
      .text(dateLabel, left + width - 100, y + 8.5, { width: 88, align: 'right', lineBreak: false });
    doc.restore();
    y += barH + 12;

    if (data.students.length === 0) {
      y = drawTableHead(y);
      doc.fontSize(9.5).font('Helvetica-Oblique').fillColor(CLASS_LIST_BRAND.muted)
        .text('No active students in this class yet.', left, y + 10, { width, align: 'center' });
    } else {
      y = drawTableHead(y);
      data.students.forEach((row, idx) => {
        if (y + rowHeight > bottom - 8) {
          doc.addPage();
          doc.fontSize(9).font('Helvetica-Bold').fillColor(CLASS_LIST_BRAND.muted)
            .text(`${data.className} — Class List (continued)`, left, 26, { lineBreak: false });
          y = 44;
          y = drawTableHead(y);
        }
        const ry = y;
        if (idx % 2 === 1) {
          doc.save();
          doc.rect(left, ry, width, rowHeight).fill(CLASS_LIST_BRAND.zebra);
          doc.restore();
        }
        doc.save();
        doc.lineWidth(0.4);
        doc.rect(left, ry, colNo, rowHeight).fillAndStroke('#ffffff', CLASS_LIST_BRAND.rule);
        doc.rect(xName, ry, colName, rowHeight).fillAndStroke(idx % 2 === 1 ? CLASS_LIST_BRAND.zebra : '#ffffff', CLASS_LIST_BRAND.rule);
        doc.rect(xId, ry, colId, rowHeight).fillAndStroke(idx % 2 === 1 ? CLASS_LIST_BRAND.zebra : '#ffffff', CLASS_LIST_BRAND.rule);
        doc.rect(xGender, ry, colGender, rowHeight).fillAndStroke(idx % 2 === 1 ? CLASS_LIST_BRAND.zebra : '#ffffff', CLASS_LIST_BRAND.rule);
        doc.restore();

        doc.font('Helvetica').fontSize(9).fillColor('#3c4256');
        doc.text(String(idx + 1), left, ry + 7.5, { width: colNo, align: 'center', lineBreak: false });
        doc.font('Helvetica').fontSize(9.5).fillColor(CLASS_LIST_BRAND.ink);
        doc.text(row.name, xName + 8, ry + 7.8, { width: colName - 16, lineBreak: false });
        doc.font('Courier').fontSize(8.5).fillColor('#3c4256');
        doc.text(row.studentId, xId + 8, ry + 8.2, { width: colId - 16, lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#3c4256');
        doc.text(row.gender?.trim() ? row.gender : '—', xGender, ry + 7.5, { width: colGender, align: 'center', lineBreak: false });
        y += rowHeight;
      });
    }

    // ── Signature block (after the table, on the last page) ──
    if (y > bottom - 130) doc.addPage();
    let sy = Math.max(y + 52, doc.y + 40);
    if (sy > bottom - 100) sy = bottom - 100;

    const dotted = '........................................';
    const sig = (label: string, yy: number) => {
      doc.font('Helvetica').fontSize(9).fillColor('#3c4256');
      doc.text(`${label}  ${dotted}`, left, yy, { width: 280, lineBreak: false });
      doc.text(`Date:  ${dotted.slice(0, 14)}`, left + width - 190, yy, { width: 190, align: 'right', lineBreak: false });
    };
    sig("Class Teacher's Signature:", sy);
    sig("Head's Signature:", sy + 34);

    // Page-1 footer (see drawFooter NOTE 2).
    drawFooter();

    doc.end();
  });
}
