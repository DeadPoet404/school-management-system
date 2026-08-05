#!/usr/bin/env python3
"""SMS-008 (backend): on-demand cumulative transcript PDFs.

Extends:
  src/lib/pdf.ts                     -- renderTranscriptPdf (A4, per-term tables,
                                      cumulative GPA, per-page footer)
Edits (anchors verified against my own SMS-005a texts + clone):
  src/modules/students/student.service.ts    -- += getTranscriptForPdf (term grouping + weighted GPA)
  src/modules/students/student.controller.ts -- import + streamTranscriptPdf + streamOwnTranscriptPdf
  src/modules/students/student.routes.ts     -- /me/transcript.pdf (STUDENT) then
                                                /:id/transcript.pdf (ADMIN+STAFF, ACCOUNTANT excluded)
  docs/PORTAL_API.md                          -- /me transcript contract

Creates:
  src/__tests__/unit/lib/transcript.test.ts  -- render smoke + pagination + service grouping (8 tests)

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms008a.py
"""
from pathlib import Path

BACKEND = Path("sms-core-backend")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def edit(rel: str, old: str, new: str, label: str, skip_marker: str) -> None:
    p = BACKEND / rel
    if not p.is_file():
        raise SystemExit(f"ABORT: {p} not found. Run from ~/sms-monorepo.")
    c = p.read_text(encoding="utf-8")
    if skip_marker in c:
        print(f"SKIP: {rel} already patched ({label}).")
        return
    p.write_text(replace_once(c, old, new, label), encoding="utf-8")
    print(f"OK: {rel}  ({label})")


PDF_TRANSCRIPT_EXTENSION = '''

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
'''

TRANSCRIPT_TESTS = '''import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    student: { findUnique: vi.fn() },
    gradeRecord: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { renderTranscriptPdf, type TranscriptPdfData, type TranscriptTermSection } from '@/lib/pdf';
import { StudentService } from '@/modules/students/student.service';

function makeRow(subject: string, code: string, gp: number, ch: number) {
  return { subject, code, caScore: 28, examScore: 56, finalScore: 84, letterGrade: 'A', gradePoints: gp, creditHours: ch };
}

function makeDto(termCount: number, rowsPerTerm: number): TranscriptPdfData {
  const terms: TranscriptTermSection[] = [];
  for (let t = 0; t < termCount; t++) {
    const rows = [];
    for (let r = 0; r < rowsPerTerm; r++) rows.push(makeRow(`Subject ${t}-${r}`, `S${t}${r}`, 3.5, 3));
    terms.push({ termName: `Term ${t + 1}`, academicYear: '2025/2026', rows, termGpa: 3.5, creditHours: rowsPerTerm * 3 });
  }
  return {
    studentName: 'Kofi Boateng',
    studentCode: 'HHA-2024-0007',
    className: 'JHS 2A — Section A',
    enrollmentDate: new Date('2024-09-01T00:00:00.000Z'),
    dateOfIssue: new Date('2026-08-05T10:00:00.000Z'),
    terms,
    cumulativeGpa: 3.42,
  };
}

describe('renderTranscriptPdf (SMS-008)', () => {
  it('produces a non-empty %PDF buffer', async () => {
    const buf = await renderTranscriptPdf(makeDto(2, 6));
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(800);
  });

  it('stamps searchable document metadata', async () => {
    const text = (await renderTranscriptPdf(makeDto(2, 6))).toString('latin1');
    expect(text).toContain('OFFICIAL ACADEMIC TRANSCRIPT');
    expect(text).toContain('Kofi Boateng');
    expect(text).toContain('HHA-2024-0007');
  });

  it('paginates long multi-term transcripts across multiple pages', async () => {
    // 8 terms x 12 rows must exceed a single A4 page.
    const buf = await renderTranscriptPdf(makeDto(8, 12));
    const pageCount = (buf.toString('latin1').match(/\\/Type \\/Page(?!s)/g) ?? []).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });

  it('renders gracefully when the student has no grade records', async () => {
    const buf = await renderTranscriptPdf({ ...makeDto(0, 0), cumulativeGpa: null });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });
});

describe('StudentService.getTranscriptForPdf (SMS-008)', () => {
  const service = new StudentService();

  const studentRow = {
    id: 'stu-1',
    studentId: 'HHA-2024-0007',
    studentName: 'Kofi Boateng',
    enrollmentDate: new Date('2024-09-01T00:00:00.000Z'),
    currentGpa: 3.42,
    placement: { class: { name: 'JHS 2A', section: 'A' } },
  };

  const rec = (termName: string, startDate: string, subject: string, code: string, gp: number, ch: number) => ({
    continuousAssessment: 28,
    examination: 56,
    finalScore: 84,
    letterGrade: 'A',
    gradePoints: gp,
    creditHours: ch,
    subject: { name: subject, code },
    term: { name: termName, academicYear: '2025/2026', startDate: new Date(startDate) },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.student.findUnique.mockResolvedValue(studentRow);
    prismaMock.gradeRecord.findMany.mockResolvedValue([
      rec('Term 1', '2025-09-01', 'English Language', 'ENG', 3.0, 3),
      rec('Term 1', '2025-09-01', 'Mathematics', 'MTH', 4.0, 3),
      rec('Term 2', '2026-01-06', 'Integrated Science', 'SCI', 3.6, 5),
    ]);
  });

  it('groups records into ordered terms with weighted GPA per term', async () => {
    const dto = await service.getTranscriptForPdf('stu-1');
    expect(dto.terms).toHaveLength(2);
    expect(dto.terms[0]!.termName).toBe('Term 1');
    expect(dto.terms[1]!.termName).toBe('Term 2');
    // Term 1: (3.0*3 + 4.0*3) / 6 = 3.50
    expect(dto.terms[0]!.termGpa).toBe(3.5);
    expect(dto.terms[0]!.creditHours).toBe(6);
    // Term 2: single course -> its own points
    expect(dto.terms[1]!.termGpa).toBe(3.6);
  });

  it('maps identity, class composition, and the stored cumulative GPA', async () => {
    const dto = await service.getTranscriptForPdf('stu-1');
    expect(dto.studentCode).toBe('HHA-2024-0007');
    expect(dto.className).toBe('JHS 2A — Section A');
    expect(dto.cumulativeGpa).toBe(3.42);
    expect(dto.terms[0]!.rows[0]).toEqual(makeRow('English Language', 'ENG', 3.0, 3));
  });

  it('returns an empty transcript with null GPA when no records exist', async () => {
    prismaMock.gradeRecord.findMany.mockResolvedValue([]);
    const dto = await service.getTranscriptForPdf('stu-1');
    expect(dto.terms).toEqual([]);
    expect(dto.cumulativeGpa).toBeNull();
  });

  it('throws 404 for an unknown student', async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);
    await expect(service.getTranscriptForPdf('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});
'''

PORTAL_DOC_BLOCK = '''
---

## 6. `GET /api/students/me/transcript.pdf` (SMS-008)

Cumulative transcript rendered on demand (A4, multi-page, per-term tables +
weighted GPA per term and cumulative). Session-resolved — a student can only
ever fetch their own transcript; spoofed ids are irrelevant by design.

| Aspect | Detail |
|---|---|
| Auth | STUDENT session cookie (or Bearer `access_token`) |
| Success | `200 OK` · `Content-Type: application/pdf` · `Content-Disposition: inline; filename="transcript-<studentId>.pdf"` |
| Errors | `401` unauthenticated · `403` non-student session · `404` student record missing |

Staff-side variant: `GET /api/students/:id/transcript.pdf` — **ADMIN + STAFF
only** (ACCOUNTANT, FACULTY and STUDENT receive `403`). Same render pipeline,
identity taken from the path id.
'''


def main() -> None:
    if not BACKEND.is_dir():
        raise SystemExit("ABORT: sms-core-backend/ not found. Run from ~/sms-monorepo.")

    # 1. extend lib/pdf.ts (append)
    pdf = BACKEND / "src/lib/pdf.ts"
    c = pdf.read_text(encoding="utf-8")
    if "renderTranscriptPdf" in c:
        print("SKIP: pdf.ts transcript renderer already present.")
    else:
        pdf.write_text(c.rstrip("\n") + "\n" + PDF_TRANSCRIPT_EXTENSION + "\n", encoding="utf-8")
        print("OK: src/lib/pdf.ts extended with renderTranscriptPdf.")

    # 2. student.service.ts — import + method
    edit(
        "src/modules/students/student.service.ts",
        'import { AppError } from \'@/middleware/error.handler\';\nimport { prisma } from "@/lib/prisma";\n',
        'import { AppError } from \'@/middleware/error.handler\';\nimport { prisma } from "@/lib/prisma";\n'
        'import type { TranscriptPdfData, TranscriptTermSection } from "@/lib/pdf";\n',
        "service transcript types import",
        'TranscriptPdfData',
    )
    edit(
        "src/modules/students/student.service.ts",
        "    if (!student) throw new AppError(404, 'Student not found.');\n"
        "    return student;\n"
        "  }",
        "    if (!student) throw new AppError(404, 'Student not found.');\n"
        "    return student;\n"
        "  }\n\n"
        "  /**\n"
        "   * SMS-008: cumulative transcript DTO. Term sections ordered by term\n"
        "   * startDate (subjects alphabetical inside), weighted GPA per term\n"
        "   * (Σ gradePoints×creditHours / Σ creditHours), cumulative carried\n"
        "   * from the service-maintained Student.currentGpa.\n"
        "   */\n"
        "  async getTranscriptForPdf(internalId: string): Promise<TranscriptPdfData> {\n"
        "    const student = await prisma.student.findUnique({\n"
        "      where: { id: internalId },\n"
        "      select: {\n"
        "        id: true,\n"
        "        studentId: true,\n"
        "        studentName: true,\n"
        "        enrollmentDate: true,\n"
        "        currentGpa: true,\n"
        "        placement: { select: { class: { select: { name: true, section: true } } } },\n"
        "      },\n"
        "    });\n"
        "    if (!student) throw new AppError(404, `Student not found with ID: ${internalId}`);\n"
        "\n"
        "    const records = await prisma.gradeRecord.findMany({\n"
        "      where: { studentId: internalId },\n"
        "      include: {\n"
        "        subject: { select: { name: true, code: true } },\n"
        "        term: { select: { name: true, academicYear: true, startDate: true } },\n"
        "      },\n"
        "      orderBy: [{ term: { startDate: 'asc' } }, { subject: { name: 'asc' } }],\n"
        "    });\n"
        "\n"
        "    const terms: TranscriptTermSection[] = [];\n"
        "    let current: TranscriptTermSection | null = null;\n"
        "    let currentKey = '';\n"
        "    for (const r of records) {\n"
        "      const key = `${r.term.name}|${r.term.academicYear}`;\n"
        "      if (!current || key !== currentKey) {\n"
        "        current = { termName: r.term.name, academicYear: r.term.academicYear, rows: [], termGpa: 0, creditHours: 0 };\n"
        "        terms.push(current);\n"
        "        currentKey = key;\n"
        "      }\n"
        "      const section: TranscriptTermSection = current;\n"
        "      const creditHours = r.creditHours;\n"
        "      const gradePoints = Number(r.gradePoints);\n"
        "      section.rows.push({\n"
        "        subject: r.subject.name,\n"
        "        code: r.subject.code,\n"
        "        caScore: Number(r.continuousAssessment),\n"
        "        examScore: Number(r.examination),\n"
        "        finalScore: Number(r.finalScore),\n"
        "        letterGrade: r.letterGrade,\n"
        "        gradePoints,\n"
        "        creditHours,\n"
        "      });\n"
        "      section.creditHours += creditHours;\n"
        "      section.termGpa += gradePoints * creditHours;\n"
        "    }\n"
        "    for (const term of terms) {\n"
        "      term.termGpa = term.creditHours > 0 ? parseFloat((term.termGpa / term.creditHours).toFixed(2)) : 0;\n"
        "    }\n"
        "\n"
        "    return {\n"
        "      studentName: student.studentName,\n"
        "      studentCode: student.studentId,\n"
        "      className: student.placement?.class\n"
        "        ? `${student.placement.class.name}${student.placement.class.section ? ` — Section ${student.placement.class.section}` : ''}`\n"
        "        : null,\n"
        "      enrollmentDate: student.enrollmentDate,\n"
        "      dateOfIssue: new Date(),\n"
        "      terms,\n"
        "      cumulativeGpa: records.length === 0 ? null : parseFloat(Number(student.currentGpa).toFixed(2)),\n"
        "    };\n"
        "  }",
        "StudentService.getTranscriptForPdf",
        "getTranscriptForPdf",
    )

    # 3. student.controller.ts — import + two stream methods
    edit(
        "src/modules/students/student.controller.ts",
        '} from "@/lib/role-dtos";\nimport { resolveSessionStudentId } from "@/middleware/self-access";\n',
        '} from "@/lib/role-dtos";\nimport { resolveSessionStudentId } from "@/middleware/self-access";\n'
        'import { renderTranscriptPdf } from "@/lib/pdf";\n',
        "controller transcript renderer import",
        "renderTranscriptPdf",
    )
    edit(
        "src/modules/students/student.controller.ts",
        "  public getStudentById = async (",
        "  /**\n"
        "   * SMS-008: GET /api/students/:id/transcript.pdf (ADMIN + STAFF only).\n"
        "   */\n"
        "  public streamTranscriptPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {\n"
        "    try {\n"
        "      const data = await this.studentService.getTranscriptForPdf(req.params.id!);\n"
        "      const pdfBuffer = await renderTranscriptPdf(data);\n"
        "      res.setHeader('Content-Type', 'application/pdf');\n"
        "      res.setHeader('Content-Disposition', `inline; filename=\"transcript-${data.studentCode}.pdf\"`);\n"
        "      return res.send(pdfBuffer);\n"
        "    } catch (error) { next(error); }\n"
        "  };\n\n"
        "  /**\n"
        "   * SMS-008: GET /api/students/me/transcript.pdf (STUDENT, session-resolved).\n"
        "   */\n"
        "  public streamOwnTranscriptPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {\n"
        "    try {\n"
        "      const internalId = resolveSessionStudentId(req.user);\n"
        "      const data = await this.studentService.getTranscriptForPdf(internalId);\n"
        "      const pdfBuffer = await renderTranscriptPdf(data);\n"
        "      res.setHeader('Content-Type', 'application/pdf');\n"
        "      res.setHeader('Content-Disposition', `inline; filename=\"transcript-${data.studentCode}.pdf\"`);\n"
        "      return res.send(pdfBuffer);\n"
        "    } catch (error) { next(error); }\n"
        "  };\n\n"
        "  public getStudentById = async (",
        "controller transcript stream methods",
        "streamTranscriptPdf",
    )

    # 4. student.routes.ts — /me/transcript.pdf THEN /:id/transcript.pdf (order matters)
    edit(
        "src/modules/students/student.routes.ts",
        'router.get("/me", requireRole(ROLES.STUDENT), controller.getOwnProfile);\n\n'
        'router.get("/:id", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getStudentById);',
        'router.get("/me", requireRole(ROLES.STUDENT), controller.getOwnProfile);\n'
        'router.get("/me/transcript.pdf", requireRole(ROLES.STUDENT), controller.streamOwnTranscriptPdf);\n'
        'router.get("/:id/transcript.pdf", requireRole(ROLES.ADMIN, ROLES.STAFF), controller.streamTranscriptPdf);\n\n'
        'router.get("/:id", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getStudentById);',
        "transcript routes (me before :id)",
        "transcript.pdf",
    )

    # 5. tests
    test_file = BACKEND / "src/__tests__/unit/lib/transcript.test.ts"
    if test_file.exists():
        raise SystemExit("ABORT: transcript.test.ts already exists.")
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text(TRANSCRIPT_TESTS, encoding="utf-8")
    print("OK: created src/__tests__/unit/lib/transcript.test.ts")

    # 6. docs/PORTAL_API.md append
    doc = BACKEND / "docs/PORTAL_API.md"
    content = doc.read_text(encoding="utf-8")
    if "me/transcript.pdf" in content:
        print("SKIP: PORTAL_API.md already documents the transcript endpoint.")
    else:
        doc.write_text(content.rstrip("\n") + "\n" + PORTAL_DOC_BLOCK, encoding="utf-8")
        print("OK: docs/PORTAL_API.md appended (/me transcript contract).")

    print()
    print("SMS-008 backend applied. Next: backend gates, docker rebuild, role-matrix curl smoke.")


if __name__ == "__main__":
    main()
