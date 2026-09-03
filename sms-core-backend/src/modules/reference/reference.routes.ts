import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";

const router = Router();

const activeFilter = { deletedAt: null, isActive: true };

/**
 * Academic ordering for class labels.
 *
 * Alphabetical sorting misplaces the ladder: "Basic 10" precedes "Basic 2",
 * and Creche/Nursery land after JHS. Rank by stage, then by the numeral in
 * the label, then by section letter.
 */
const STAGE_RANK: Array<[RegExp, number]> = [
  [/^creche/i, 0],
  [/^nursery/i, 1],
  [/^kg\b|^kindergarten/i, 2],
  [/^basic|^primary|^class\s*\d/i, 3],
  [/^jhs|^junior/i, 4],
  [/^shs|^senior/i, 5],
];

type ClassRow = { id: string; name: string; section: string | null; isActive: boolean };

function classSortKey(row: ClassRow): [number, number, string] {
  const name = (row.name || "").trim();

  let stage = 99;
  for (const [pattern, rank] of STAGE_RANK) {
    if (pattern.test(name)) { stage = rank; break; }
  }

  const numeral = name.match(/\d+/);
  const level = numeral ? parseInt(numeral[0], 10) : 0;

  const letter = (row.section || name.match(/([A-Z])\s*$/i)?.[1] || "").toUpperCase();

  return [stage, level, letter];
}

export function sortClassesByLadder<T extends ClassRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const [sa, la, ta] = classSortKey(a);
    const [sb, lb, tb] = classSortKey(b);
    if (sa !== sb) return sa - sb;
    if (la !== lb) return la - lb;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * GET /api/reference/classes
 * Returns active classes (used by enrollment forms, attendance, timetable).
 */
router.get("/classes", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.FACULTY, ROLES.ACCOUNTANT), async (_req, res, next) => {
  try {
    const rows = await prisma.class.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, section: true, isActive: true },
    });
    res.status(200).json({ success: true, data: sortClassesByLadder(rows) });
  } catch (e) { next(e); }
});

/**
 * GET /api/reference/subjects
 */
router.get("/subjects", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.FACULTY, ROLES.ACCOUNTANT), async (_req, res, next) => {
  try {
    const rows = await prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, isActive: true },
    });
    res.status(200).json({ success: true, data: rows });
  } catch (e) { next(e); }
});

/**
 * GET /api/reference/departments
 */
router.get("/departments", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.FACULTY, ROLES.ACCOUNTANT), async (_req, res, next) => {
  try {
    const rows = await prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, isActive: true },
    });
    res.status(200).json({ success: true, data: rows });
  } catch (e) { next(e); }
});

/**
 * GET /api/reference/fee-tiers
 */
router.get("/fee-tiers", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.ACCOUNTANT), async (_req, res, next) => {
  try {
    const rows = await prisma.feeTier.findMany({
      where: { deletedAt: null },
      orderBy: { amount: "asc" },
      select: { id: true, name: true, code: true, amount: true, isActive: true },
    });
    res.status(200).json({ success: true, data: rows });
  } catch (e) { next(e); }
});

/**
 * GET /api/reference/terms
 */
router.get("/terms", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.FACULTY, ROLES.ACCOUNTANT), async (_req, res, next) => {
  try {
    const rows = await prisma.term.findMany({
      where: { deletedAt: null },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, academicYear: true, startDate: true, endDate: true, isActive: true },
    });
    res.status(200).json({ success: true, data: rows });
  } catch (e) { next(e); }
});

/**
 * GET /api/reference/teachers/lookup
 * Lightweight teacher lookup used by the timetable config UI (assigns subjects to teachers).
 */
router.get("/teachers", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.FACULTY), async (_req, res, next) => {
  try {
    const rows = await prisma.teacher.findMany({
      where: { status: "ACTIVE" },
      orderBy: { teacherName: "asc" },
      select: { id: true, teacherId: true, teacherName: true, email: true, department: true, subject: true },
    });
    res.status(200).json({ success: true, data: rows });
  } catch (e) { next(e); }
});

export default router;
