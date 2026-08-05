from pathlib import Path

# SMS-005 Block A: session-resolved /me endpoint family (code).
#   GET /api/students/me      -> portal profile DTO (no compliance/billing)
#   GET /api/grades/me        -> session-resolved gradebook (existing service)
#   GET /api/attendance/me    -> session-resolved history + summary
#   GET /api/timetable/me     -> the student's class schedule (new read path)
# Identity ALWAYS comes from the verified JWT (resolveSessionStudentId),
# never from request parameters -- cross-student access is impossible by
# construction. Routes gate on requireRole(ROLES.STUDENT). Every /me route is
# registered BEFORE any /:id-style param route to avoid shadowing.

def replace_once(content, old, new, label):
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)

changed = []
BASE = 'sms-core-backend/src'

# ── 1. middleware/self-access.ts: resolveSessionStudentId ────────────────
p = Path(f'{BASE}/middleware/self-access.ts')
c = p.read_text(encoding='utf-8')
if 'resolveSessionStudentId' in c:
    raise SystemExit('ABORT [self-access]: resolveSessionStudentId already present.')
c = c.rstrip('\n') + '''\n
// SMS-005: Session-resolved student identity for the /me endpoint family.
// The student id ALWAYS comes from the verified JWT -- never from request
// params, query, or body -- making cross-student access impossible by
// construction rather than by convention.
export function resolveSessionStudentId(user: JwtPayload | undefined): string {
  if (!user) {
    throw new AppError(401, 'Authentication required.');
  }
  if (user.entityType !== 'STUDENT' || !user.entityInternalId) {
    throw new AppError(403, 'This endpoint is for student self-service.');
  }
  return user.entityInternalId;
}
'''
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 2. student.service.ts: getOwnProfile ─────────────────────────────────
p = Path(f'{BASE}/modules/students/student.service.ts')
c = p.read_text(encoding='utf-8')
profile_method = '''  constructor(private repo: IStudentRepository = new StudentRepository()) {}

  /**
   * SMS-005: Portal self-view profile. Portal-shaped DTO only -- compliance,
   * billing, invoice/payment, and departure internals are never selected.
   * Identity always comes from the verified session, never from parameters.
   */
  async getOwnProfile(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        enrollmentDate: true,
        status: true,
        currentGpa: true,
        attendanceRate: true,
        placement: {
          select: {
            academicTrack: true,
            boardingStatus: true,
            class: { select: { id: true, name: true, section: true } },
          },
        },
        demographics: { select: { dateOfBirth: true, gender: true } },
        guardians: {
          select: { name: true, relationship: true, phone: true, email: true },
        },
      },
    });

    if (!student) throw new AppError(404, 'Student not found.');
    return student;
  }'''
c = replace_once(c,
    '  constructor(private repo: IStudentRepository = new StudentRepository()) {}',
    profile_method,
    'student service')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 3. student.controller.ts: import + getOwnProfile ─────────────────────
p = Path(f'{BASE}/modules/students/student.controller.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    '} from "@/lib/role-dtos";',
    '} from "@/lib/role-dtos";\nimport { resolveSessionStudentId } from "@/middleware/self-access";',
    'student controller import')
profile_ctrl = '''  /**
   * SMS-005: GET /api/students/me -- portal self-view profile.
   * Identity is resolved from the verified session (never parameters).
   */
  public getOwnProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const studentId = resolveSessionStudentId(req.user);
      const profile = await this.studentService.getOwnProfile(studentId);
      return res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  public getStudentById = async ('''
c = replace_once(c,
    '  public getStudentById = async (',
    profile_ctrl,
    'student controller method')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 4. student.routes.ts: /me BEFORE /:id ────────────────────────────────
p = Path(f'{BASE}/modules/students/student.routes.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    'router.get("/:id", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getStudentById);',
    '// SMS-005: portal self-view. MUST stay BEFORE /:id -- otherwise Express\n'
    '// binds the literal "me" to the :id parameter and this route is shadowed.\n'
    'router.get("/me", requireRole(ROLES.STUDENT), controller.getOwnProfile);\n\n'
    'router.get("/:id", requireRole(ROLES.STAFF, ROLES.FACULTY, ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getStudentById);',
    'student routes')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 5. grades.controller.ts: import + getOwnGradebook ────────────────────
p = Path(f'{BASE}/modules/grades/grades.controller.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    'import { assertSelfOrPrivilegedStudentAccess } from "@/middleware/self-access";',
    'import { assertSelfOrPrivilegedStudentAccess, resolveSessionStudentId } from "@/middleware/self-access";',
    'grades controller import')
grades_ctrl = '''  /**
   * SMS-005: GET /api/grades/me -- session-resolved gradebook alias of the
   * existing per-student read (the portal transcript source).
   */
  public getOwnGradebook = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    try {
      const studentId = resolveSessionStudentId(req.user);
      const termId =
        typeof req.query.termId === "string" ? req.query.termId : undefined;
      const gradebook = await this.gradesService.getStudentGradebook(studentId, termId);
      return res.status(200).json({ success: true, data: gradebook });
    } catch (error) {
      next(error);
    }
  };

  /**
   * D-07: PATCH /api/grades/:id - correct a mark, with audit trail.'''
c = replace_once(c,
    '  /**\n   * D-07: PATCH /api/grades/:id - correct a mark, with audit trail.',
    grades_ctrl,
    'grades controller method')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 6. grades.routes.ts ──────────────────────────────────────────────────
p = Path(f'{BASE}/modules/grades/grades.routes.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    '// One student\'s transcript: /api/grades/student/:studentId?termId=\nrouter.get(\n  "/student/:studentId",',
    '// SMS-005: session-resolved gradebook for the portal (identity from JWT only).\n'
    'router.get("/me", requireRole(ROLES.STUDENT), gradesController.getOwnGradebook);\n\n'
    '// One student\'s transcript: /api/grades/student/:studentId?termId=\nrouter.get(\n  "/student/:studentId",',
    'grades routes')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 7. attendance.controller.ts: import + getOwnHistory ──────────────────
p = Path(f'{BASE}/modules/attendance/attendance.controller.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    'import { assertSelfOrPrivilegedStudentAccess } from "@/middleware/self-access";',
    'import { assertSelfOrPrivilegedStudentAccess, resolveSessionStudentId } from "@/middleware/self-access";',
    'attendance controller import')
attendance_ctrl = '''  /**
   * SMS-005: GET /api/attendance/me -- session-resolved attendance history
   * plus summary metrics. Same query contract as the param-keyed read.
   */
  public getOwnHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const studentId = resolveSessionStudentId(req.user);
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const limit = Math.min(
        200,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
      );
      const history = await this.attendanceService.getStudentHistory(studentId, { from, to, limit });
      return res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  };

  public getClassSheet = async ('''
c = replace_once(c,
    '  public getClassSheet = async (',
    attendance_ctrl,
    'attendance controller method')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 8. attendance.routes.ts ──────────────────────────────────────────────
p = Path(f'{BASE}/modules/attendance/attendance.routes.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    '// View attendance history for one student (self for STUDENT, or staff)\nrouter.get(\n  "/student/:studentId",',
    '// SMS-005: session-resolved attendance history for the portal.\n'
    'router.get(\n  "/me",\n  requireRole(ROLES.STUDENT),\n  controller.getOwnHistory,\n);\n\n'
    '// View attendance history for one student (self for STUDENT, or staff)\nrouter.get(\n  "/student/:studentId",',
    'attendance routes')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 9. timetable.controller.ts: imports + getOwnTimetable ────────────────
p = Path(f'{BASE}/modules/timetable/timetable.controller.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    'import { Request, Response, NextFunction } from "express";\nimport { TimetableService } from "./timetable.service";',
    'import { Request, Response, NextFunction } from "express";\nimport { TimetableService } from "./timetable.service";\nimport { AuthenticatedRequest } from "@/middleware/auth.middleware";\nimport { resolveSessionStudentId } from "@/middleware/self-access";',
    'timetable controller imports')
timetable_ctrl = '''  /**
   * SMS-005: GET /api/timetable/me -- the session student\'s class schedule
   * (periods, breaks, subject-teacher allocations). Identity from JWT only.
   */
  public getOwnTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const studentId = resolveSessionStudentId(req.user);
      const data = await this.timetableService.getOwnTimetable(studentId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  public saveMatrix = async ('''
c = replace_once(c,
    '  public saveMatrix = async (',
    timetable_ctrl,
    'timetable controller method')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 10. timetable.service.ts: getOwnTimetable ────────────────────────────
p = Path(f'{BASE}/modules/timetable/timetable.service.ts')
c = p.read_text(encoding='utf-8')
timetable_method = '''  /**
   * SMS-005: The session student\'s class schedule for the portal.
   * Placement -> TimetableConfiguration (sectionId == Class.id, canonical).
   * Teacher names are resolved in one batched lookup. When the class has no
   * configuration yet, `timetable` is null rather than an error -- the portal
   * can render an empty state.
   */
  async getOwnTimetable(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        studentName: true,
        placement: {
          select: {
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!student) throw new AppError(404, 'Student not found.');

    const classInfo = student.placement?.class ?? null;
    if (!student.placement?.classId || !classInfo) {
      throw new AppError(404, 'No class placement found for this student.');
    }

    const config = await prisma.timetableConfiguration.findUnique({
      where: { sectionId: student.placement.classId },
      include: {
        periods: { orderBy: { periodNumber: 'asc' } },
        breaks: true,
        subjects: true,
      },
    });

    if (!config) {
      return { class: classInfo, timetable: null };
    }

    // Batch-resolve teacher names for the subject allocations.
    const teacherIds = [...new Set(config.subjects.map((s) => s.teacherId))];
    const teachers = await prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, teacherName: true },
    });
    const teacherNameById = new Map(teachers.map((t) => [t.id, t.teacherName]));

    return {
      class: classInfo,
      timetable: {
        periodsCount: config.periodsCount,
        periods: config.periods.map((p) => ({
          periodNumber: p.periodNumber,
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        })),
        breaks: config.breaks.map((b) => ({
          name: b.name,
          dayOfWeek: b.dayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
        subjects: config.subjects.map((s) => ({
          subjectName: s.subjectName,
          teacherName: teacherNameById.get(s.teacherId) ?? null,
          dayOfWeek: s.dayOfWeek,
        })),
      },
    };
  }

  async replaceGlobalMatrix('''
c = replace_once(c,
    '  async replaceGlobalMatrix(',
    timetable_method,
    'timetable service method')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

# ── 11. timetable.routes.ts ──────────────────────────────────────────────
p = Path(f'{BASE}/modules/timetable/timetable.routes.ts')
c = p.read_text(encoding='utf-8')
c = replace_once(c,
    'router.get("/matrix", requireRole(ROLES.ADMIN, ROLES.FACULTY), controller.getMatrix);',
    '// SMS-005: session-resolved class schedule for the portal.\n'
    'router.get("/me", requireRole(ROLES.STUDENT), controller.getOwnTimetable);\n\n'
    'router.get("/matrix", requireRole(ROLES.ADMIN, ROLES.FACULTY), controller.getMatrix);',
    'timetable routes')
p.write_text(c, encoding='utf-8'); changed.append(str(p))

print("SMS-005 Block A applied (4 endpoints across 11 file edits):")
for f in changed: print(f"  - {f}")
print("Next: apply_sms005b.py (tests + PORTAL_API.md), then the gates.")
