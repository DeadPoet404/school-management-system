import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLES } from "@/middleware/rbac.middleware";

const router = Router();

const activeFilter = { deletedAt: null, isActive: true };

/**
 * GET /api/reference/classes
 * Returns active classes (used by enrollment forms, attendance, timetable).
 */
router.get("/classes", requireRole(ROLES.STAFF, ROLES.ADMIN, ROLES.FACULTY, ROLES.ACCOUNTANT), async (_req, res, next) => {
  try {
    const rows = await prisma.class.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, section: true, isActive: true },
    });
    res.status(200).json({ success: true, data: rows });
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
router.get("/teachers", requireRole(ROLES.STAFF, ROLES.ADMIN), async (_req, res, next) => {
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
