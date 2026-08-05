#!/usr/bin/env python3
"""SMS-010 (backend): per-class .ics calendar feeds with stateless HMAC tokens.

Creates:
  src/lib/calendar.ts                          -- RFC 5545 serializer (weekly RRULE, term-bounded
                                                UNTIL, CRLF, 75-octet folding) + HMAC token util
  src/modules/timetable/calendar-feed.routes.ts -- PUBLIC feed route (token is the credential)
  src/__tests__/unit/lib/calendar.test.ts      -- token + serializer + service mapping (11 tests)

Edits:
  src/lib/env.ts                        -- CALENDAR_FEED_SECRET (optional, ''-normalized, 503 idiom)
  src/modules/timetable/timetable.service.ts    -- += getCalendarEventsForClass (option A mapping:
                                                   weekday template + round-robin subjects + breaks)
  src/modules/timetable/timetable.controller.ts -- += mintCalendarToken (signed link minting)
  src/modules/timetable/timetable.routes.ts     -- POST /calendar/:classId/token (ADMIN+FACULTY)
  src/app.ts                              -- mount public feed BEFORE the authenticated timetable mount
  sms-core-backend/.env.example, .env.example, docker-compose.yml -- secret plumbing
  docs/CALENDAR_FEEDS.md (new)          -- deployment checklist note

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms010a.py
"""
from pathlib import Path

ROOT = Path(".")
BACKEND = Path("sms-core-backend")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def edit(path: Path, old: str, new: str, label: str, skip_marker: str) -> None:
    if not path.is_file():
        raise SystemExit(f"ABORT: {path} not found. Run from ~/sms-monorepo.")
    c = path.read_text(encoding="utf-8")
    if skip_marker in c:
        print(f"SKIP: {path} already patched ({label}).")
        return
    path.write_text(replace_once(c, old, new, label), encoding="utf-8")
    print(f"OK: {path}  ({label})")


def append_once(path: Path, block: str, label: str, skip_marker: str) -> None:
    if not path.is_file():
        raise SystemExit(f"ABORT: {path} not found.")
    c = path.read_text(encoding="utf-8")
    if skip_marker in c:
        print(f"SKIP: {path} already contains {label}.")
        return
    path.write_text(c.rstrip("\n") + "\n\n" + block.strip("\n") + "\n", encoding="utf-8")
    print(f"OK: {path}  ({label} appended)")


def create(path: Path, body: str) -> None:
    if path.exists():
        raise SystemExit(f"ABORT: {path} already exists. Refusing to overwrite.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    print(f"OK: created {path}")


CALENDAR_LIB = '''/**
 * SMS-010 -- iCalendar (RFC 5545) serialization + stateless feed tokens.
 *
 * Feed semantics (ratified "option A" mapping): the app's own matrix is a
 * weekday template without day/slot binding, so every configured period
 * becomes a weekly MO-FR recurring event at its true times; subjects are
 * deterministically round-robined into the slots; breaks render as labelled
 * lightweight events. UNTIL bounds the recurrence to the active term.
 *
 * Timezone note: the deployment school is in Ghana (Africa/Accra, no DST),
 * so wall-clock == UTC. Emitting RFC-perfect UTC (…Z) times is therefore
 * exact, and lets UNTIL stay spec-compliant without a VTIMEZONE block.
 *
 * Token design (stateless -- no tables):  v1.<classId>.<issuedAtMs> signed
 * with HMAC-SHA256(CALENDAR_FEED_SECRET, payload), base64url-encoded.
 * Rotation strategy: bump CALENDAR_FEED_SECRET (and optionally the version
 * prefix) to invalidate every outstanding link at once; "regenerate" simply
 * re-signs with a fresh issuedAt.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startHHmm: string; // "08:00"
  endHHmm: string;   // "08:45"
}

export interface CalendarFeedData {
  calendarName: string;
  events: CalendarEventInput[];
  termStart: Date;
  termEnd: Date;
}

// ── Token utilities ──────────────────────────────────────────────────────────

const TOKEN_VERSION = 'v1';

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

export function issueFeedToken(classId: string, secret: string, issuedAt: number = Date.now()): string {
  const payload = `${TOKEN_VERSION}.${classId}.${issuedAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${base64url(payload)}.${signature}`;
}

export function verifyFeedToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const encodedPayload = token.slice(0, dot);
  const presentedSignature = token.slice(dot + 1);
  const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  const [version, classId] = payload.split('.');
  if (version !== TOKEN_VERSION || !classId) return null;

  const expected = createHmac('sha256', secret).update(payload).digest();
  const presented = Buffer.from(presentedSignature, 'base64url');
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) return null;
  return classId;
}

// ── ICS serialization ────────────────────────────────────────────────────────

function escapeIcsText(value: string): string {
  return value.replace(/\\\\/g, '\\\\\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\\n/g, '\\n');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** First Monday-Friday day on/after the anchor (so DTSTART matches the RRULE BYDAY pattern). */
function firstWeekdayOnOrAfter(anchor: Date): Date {
  const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function atTime(day: Date, hhmm: string): Date {
  const [h = '0', m = '0'] = hhmm.split(':');
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Number(h), Number(m), 0));
}

/** RFC 5545 §3.1: content lines SHOULD NOT exceed 75 octets — fold with a leading space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push((i === 0 ? '' : ' ') + line.slice(i, i + 74));
  return parts.join('\\r\\n');
}

export function buildIcsFeed(feed: CalendarFeedData, uidDomain = 'sms.local'): string {
  const firstDay = firstWeekdayOnOrAfter(feed.termStart);
  const until = formatIcsUtc(new Date(feed.termEnd.getTime() + 86399000)); // end-of-day UTC
  const dtstamp = formatIcsUtc(new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//School Management System//Class Timetable Feeds//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcsText(feed.calendarName)}`),
  ];

  feed.events.forEach((event, index) => {
    const dtStart = atTime(firstDay, event.startHHmm);
    const dtEnd = atTime(firstDay, event.endHHmm);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${index}@${uidDomain}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatIcsUtc(dtStart)}`,
      `DTEND:${formatIcsUtc(dtEnd)}`,
      'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=' + until,
      foldLine(`SUMMARY:${escapeIcsText(event.summary)}`),
    );
    if (event.description) lines.push(foldLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\\r\\n') + '\\r\\n';
}
'''

CALENDAR_FEED_ROUTES = '''/**
 * SMS-010 -- PUBLIC per-class .ics feed.
 *
 * This router is mounted in app.ts BEFORE the authenticated /api/timetable
 * mount on purpose: calendar applications (Google Calendar et al.) cannot
 * carry our JWT cookies, so the stateless HMAC token in ?token= IS the
 * credential. The global apiLimiter still applies to this path. Feeds are
 * read-only by construction.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/error.handler';
import { verifyFeedToken, buildIcsFeed } from '@/lib/calendar';
import { TimetableService } from './timetable.service';

const router = Router();
const timetableService = new TimetableService();

router.get('/:classId.ics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.CALENDAR_FEED_SECRET;
    if (!secret) throw new AppError(503, 'Calendar feeds are disabled: CALENDAR_FEED_SECRET is not configured.');

    const classId = verifyFeedToken(String(req.query.token ?? ''), secret);
    if (!classId || classId !== req.params.classId) {
      throw new AppError(401, 'A valid feed token is required.');
    }

    const feed = await timetableService.getCalendarEventsForClass(classId);
    const ics = buildIcsFeed(feed);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // subscribers poll; Google lags hours anyway
    return res.send(ics);
  } catch (error) {
    next(error);
  }
});

export default router;
'''

CALENDAR_TESTS = '''import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    class: { findUnique: vi.fn() },
    timetableConfiguration: { findUnique: vi.fn() },
    teacher: { findMany: vi.fn() },
    term: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { issueFeedToken, verifyFeedToken, buildIcsFeed } from '@/lib/calendar';
import { TimetableService } from '@/modules/timetable/timetable.service';

const SECRET = 'test-calendar-secret-32chars-long!!!';

describe('calendar feed tokens (SMS-010)', () => {
  it('round-trips: issuer output verifies back to the classId', () => {
    const token = issueFeedToken('class-1', SECRET);
    expect(verifyFeedToken(token, SECRET)).toBe('class-1');
  });

  it('rejects when the payload is tampered', () => {
    const token = issueFeedToken('class-1', SECRET);
    const [payload, signature] = token.split('.');
    const forged = `${Buffer.from('v1.class-99.1').toString('base64url')}.${signature}`;
    expect(verifyFeedToken(forged, SECRET)).toBeNull();
    expect(payload).not.toBeUndefined();
  });

  it('rejects under a different secret (rotation invalidates links)', () => {
    const token = issueFeedToken('class-1', SECRET);
    expect(verifyFeedToken(token, 'rotated-secret')).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyFeedToken('garbage', SECRET)).toBeNull();
    expect(verifyFeedToken('', SECRET)).toBeNull();
    expect(verifyFeedToken('a.b.c', SECRET)).toBeNull();
  });
});

describe('buildIcsFeed (SMS-010)', () => {
  const feed = {
    calendarName: 'JHS 1A Timetable',
    termStart: new Date('2026-09-07T00:00:00Z'), // Monday
    termEnd: new Date('2026-12-11T00:00:00Z'),
    events: [
      { summary: 'Mathematics — Efua Mensah (P1)', startHHmm: '08:00', endHHmm: '08:45' },
      { summary: 'Break, Team Meet — Morning Break', startHHmm: '10:30', endHHmm: '10:50' },
    ],
  };

  it('emits RFC 5545 structure with CRLF terminators', () => {
    const ics = buildIcsFeed(feed);
    expect(ics).toContain('BEGIN:VCALENDAR\\r\\n');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//School Management System//Class Timetable Feeds//EN');
    expect(ics).toContain('X-WR-CALNAME:JHS 1A Timetable');
    expect(ics).toContain('END:VCALENDAR\\r\\n');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('writes weekly weekday RRULEs bounded by the term, with UTC schedule stamps', () => {
    const ics = buildIcsFeed(feed);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261211T235959Z');
    expect(ics).toMatch(/DTSTART:20260907T080000Z/);
    expect(ics).toMatch(/DTEND:20260907T084500Z/);
  });

  it('escapes reserved characters in text values', () => {
    const ics = buildIcsFeed(feed);
    expect(ics).toContain('SUMMARY:Break\\\\, Team Meet — Morning Break');
  });
});

describe('TimetableService.getCalendarEventsForClass (SMS-010, option A mapping)', () => {
  const service = new TimetableService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.class.findUnique.mockResolvedValue({ id: 'class-1', name: 'JHS 1A', section: 'A', deletedAt: null });
    prismaMock.term.findFirst.mockResolvedValue({
      startDate: new Date('2026-09-07T00:00:00Z'),
      endDate: new Date('2026-12-11T00:00:00Z'),
    });
    prismaMock.teacher.findMany.mockResolvedValue([
      { id: 't-1', teacherName: 'Efua Mensah' },
      { id: 't-2', teacherName: 'Yaw Darko' },
    ]);
    prismaMock.timetableConfiguration.findUnique.mockResolvedValue({
      periods: [
        { periodNumber: 1, startTime: '08:00', endTime: '08:45' },
        { periodNumber: 2, startTime: '08:45', endTime: '09:30' },
        { periodNumber: 3, startTime: '09:30', endTime: '10:15' },
      ],
      breaks: [{ name: 'Morning Break', startTime: '10:30', endTime: '10:50' }],
      subjects: [
        { subjectName: 'English Language', teacherId: 't-2' },
        { subjectName: 'Mathematics', teacherId: 't-1' },
      ],
    });
  });

  it('maps periods+breaks to events, round-robin pairing subjects and teachers', async () => {
    const feed = await service.getCalendarEventsForClass('class-1');
    expect(feed.calendarName).toContain('JHS 1A');
    expect(feed.events).toHaveLength(4); // 3 periods + 1 break
    expect(feed.events[0]!.summary).toBe('English Language — Yaw Darko (P1)');
    expect(feed.events[1]!.summary).toBe('Mathematics — Efua Mensah (P2)');
    expect(feed.events[2]!.summary).toBe('English Language — Yaw Darko (P3)');
    expect(feed.events[3]!.summary).toBe('Break — Morning Break');
    expect(feed.termStart.toISOString()).toContain('2026-09-07');
  });

  it('throws 404 for an unknown class', async () => {
    prismaMock.class.findUnique.mockResolvedValue(null);
    await expect(service.getCalendarEventsForClass('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 for a soft-deleted class', async () => {
    prismaMock.class.findUnique.mockResolvedValue({ id: 'class-1', name: 'JHS 1A', section: 'A', deletedAt: new Date() });
    await expect(service.getCalendarEventsForClass('class-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when the class has no timetable configuration', async () => {
    prismaMock.timetableConfiguration.findUnique.mockResolvedValue(null);
    await expect(service.getCalendarEventsForClass('class-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
'''

CALENDAR_FEEDS_DOC = '''# Calendar Feeds (SMS-010) — Deployment Checklist

Per-class `.ics` feeds let staff subscribe whole timetables in Google
Calendar (or any RFC 5545 client).

## What ships

| Piece | Detail |
|---|---|
| Mint (authenticated) | `POST /api/timetable/calendar/:classId/token` — ADMIN + FACULTY. Returns `{ token, path }`. |
| Public feed | `GET /api/timetable/calendar/:classId.ics?token=…` — token-authenticated (no JWT); `text/calendar`; read-only; rate-limited by the global limiter. |
| Env | `CALENDAR_FEED_SECRET` — unset keeps feeds disabled (503 everywhere). |
| UI | Timetable & Scheduling module: Copy link / Subscribe via Google / Regenerate. |

## Operational notes (ratified at backlog freeze)

1. **Public reachability.** Google fetches the feed URL from *its* servers —
   the URL's host must be publicly reachable (a `localhost`/LAN URL subscribes
   for you locally but Google cannot poll it). The compose frontend proxies
   `/api/*`, so feeds work through the frontend origin too.
2. **Refresh lag.** Google's subscription refresh lags hours; timetable edits
   are never instant in subscribers' calendars. Term boundaries (RRULE UNTIL)
   apply automatically.
3. **Token rotation.** Tokens are stateless HMAC (`v1.<classId>.<iat>` +
   signature). Regenerating a link re-signs instantly; rotating
   `CALENDAR_FEED_SECRET` invalidates ALL outstanding links at once (version
   prefix exists for staged rotations).
4. **Mapping limitation (option A).** The app matrix is a weekday template,
   so subjects are round-robined into slots and every event recurs MO–FR
   until term end. Ghana time (Africa/Accra, no DST) is emitted as UTC.
'''

MINT_METHOD = '''  /**
   * SMS-010: POST /api/timetable/calendar/:classId/token — mint a signed
   * subscription link for an .ics feed. The feed itself is public (token is
   * the credential); class existence is enforced at feed time (404), which
   * keeps minting stateless and cheap.
   */
  public mintCalendarToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const secret = process.env.CALENDAR_FEED_SECRET;
      if (!secret) throw new AppError(503, 'Calendar feeds are disabled: CALENDAR_FEED_SECRET is not configured.');
      const classId = String(req.params.classId);
      const token = issueFeedToken(classId, secret);
      return res.status(200).json({
        success: true,
        data: { token, path: `/api/timetable/calendar/${classId}.ics?token=${token}` },
      });
    } catch (error) { next(error); }
  };

'''


def main() -> None:
    if not BACKEND.is_dir():
        raise SystemExit("ABORT: sms-core-backend/ not found. Run from ~/sms-monorepo.")

    create(BACKEND / "src/lib/calendar.ts", CALENDAR_LIB)
    create(BACKEND / "src/modules/timetable/calendar-feed.routes.ts", CALENDAR_FEED_ROUTES)
    create(BACKEND / "src/__tests__/unit/lib/calendar.test.ts", CALENDAR_TESTS)
    create(BACKEND / "docs/CALENDAR_FEEDS.md", CALENDAR_FEEDS_DOC)

    # env.ts additions
    edit(
        BACKEND / "src/lib/env.ts",
        "  GMAIL_APP_PASSWORD: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n",
        "  GMAIL_APP_PASSWORD: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(1).optional(),\n"
        "  ),\n"
        "  // SMS-010: HMAC signing secret for stateless .ics feed tokens.\n"
        "  // Optional -- feeds + token minting answer 503 while unset.\n"
        "  CALENDAR_FEED_SECRET: z.preprocess(\n"
        "    (v) => (v === '' ? undefined : v),\n"
        "    z.string().min(32, 'CALENDAR_FEED_SECRET should be at least 32 random characters.').optional(),\n"
        "  ),\n",
        "env: calendar secret schema",
        "CALENDAR_FEED_SECRET: z.preprocess",
    )
    edit(
        BACKEND / "src/lib/env.ts",
        "  if (env.GMAIL_APP_PASSWORD) process.env.GMAIL_APP_PASSWORD = env.GMAIL_APP_PASSWORD;\n",
        "  if (env.GMAIL_APP_PASSWORD) process.env.GMAIL_APP_PASSWORD = env.GMAIL_APP_PASSWORD;\n"
        "  if (env.CALENDAR_FEED_SECRET) process.env.CALENDAR_FEED_SECRET = env.CALENDAR_FEED_SECRET;\n",
        "env: calendar secret merge-back",
        "if (env.CALENDAR_FEED_SECRET)",
    )

    append_once(
        BACKEND / ".env.example",
        "# -- Class Timetable Calendar Feeds (SMS-010) ----------------------------\n"
        "# HMAC secret signing the .ics subscription tokens. Generate with\n"
        "#   openssl rand -hex 32\n"
        "# Leave blank to keep feeds disabled (503). Rotate to invalidate all links.\n"
        "CALENDAR_FEED_SECRET=",
        "calendar feed secret",
        "CALENDAR_FEED_SECRET",
    )
    append_once(
        ROOT / ".env.example",
        "# -- Class Timetable Calendar Feeds (SMS-010) ----------------------------\n"
        "# Passed through to the backend. openssl rand -hex 32. Blank keeps feeds off.\n"
        "CALENDAR_FEED_SECRET=",
        "calendar feed secret",
        "CALENDAR_FEED_SECRET",
    )
    edit(
        ROOT / "docker-compose.yml",
        "      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}\n",
        "      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}\n"
        "      # -- Class Timetable Calendar Feeds (SMS-010) --\n"
        "      CALENDAR_FEED_SECRET: ${CALENDAR_FEED_SECRET:-}\n",
        "compose calendar secret pass-through",
        "CALENDAR_FEED_SECRET:",
    )

    # timetable.service.ts — calendar events mapping (anchor before replaceGlobalMatrix)
    edit(
        BACKEND / "src/modules/timetable/timetable.service.ts",
        "  async replaceGlobalMatrix(\n",
        "  /**\n"
        "   * SMS-010: feed projection for one class (option A mapping — the app\n"
        "   * matrix is an unslotted weekday template, so subjects round-robin\n"
        "   * into period slots and every event recurs MO-FR until term end).\n"
        "   */\n"
        "  async getCalendarEventsForClass(classId: string) {\n"
        "    const classRow = await prisma.class.findUnique({\n"
        "      where: { id: classId },\n"
        "      select: { id: true, name: true, section: true, deletedAt: true },\n"
        "    });\n"
        "    if (!classRow || classRow.deletedAt) throw new AppError(404, `Class not found: ${classId}`);\n"
        "\n"
        "    const config = await prisma.timetableConfiguration.findUnique({\n"
        "      where: { sectionId: classId },\n"
        "      include: {\n"
        "        periods: { orderBy: { periodNumber: 'asc' } },\n"
        "        breaks: { orderBy: { startTime: 'asc' } },\n"
        "        subjects: { orderBy: { subjectName: 'asc' } },\n"
        "      },\n"
        "    });\n"
        "    if (!config) throw new AppError(404, `No timetable configured for class ${classRow.name}.`);\n"
        "\n"
        "    const activeTerm = await prisma.term.findFirst({\n"
        "      where: { isActive: true, deletedAt: null },\n"
        "      orderBy: { startDate: 'desc' },\n"
        "    });\n"
        "    const termStart = activeTerm?.startDate ?? new Date();\n"
        "    const termEnd = activeTerm?.endDate ?? new Date(termStart.getTime() + 90 * 86400000);\n"
        "\n"
        "    const teacherIds = [...new Set(config.subjects.map((s) => s.teacherId))];\n"
        "    const teachers = await prisma.teacher.findMany({\n"
        "      where: { id: { in: teacherIds } },\n"
        "      select: { id: true, teacherName: true },\n"
        "    });\n"
        "    const teacherNames = new Map(teachers.map((t) => [t.id, t.teacherName]));\n"
        "\n"
        "    const events = config.periods.map((period, index) => {\n"
        "      const subject = config.subjects.length > 0 ? config.subjects[index % config.subjects.length]! : null;\n"
        "      const teacher = subject ? teacherNames.get(subject.teacherId) : null;\n"
        "      return {\n"
        "        summary: subject\n"
        "          ? `${subject.subjectName}${teacher ? ` — ${teacher}` : ''} (P${period.periodNumber})`\n"
        "          : `Period ${period.periodNumber}`,\n"
        "        description: `${classRow.name} timetable period ${period.periodNumber} — generated class feed`,\n"
        "        startHHmm: period.startTime,\n"
        "        endHHmm: period.endTime,\n"
        "      };\n"
        "    });\n"
        "    for (const b of config.breaks) {\n"
        "      events.push({ summary: `Break — ${b.name}`, description: 'Scheduled break', startHHmm: b.startTime, endHHmm: b.endTime });\n"
        "    }\n"
        "\n"
        "    const classLabel = `${classRow.name}${classRow.section ? ` — Section ${classRow.section}` : ''}`;\n"
        "    return { calendarName: `SMS Timetable — ${classLabel}`, events, termStart, termEnd };\n"
        "  }\n\n"
        "  async replaceGlobalMatrix(\n",
        "TimetableService.getCalendarEventsForClass",
        "getCalendarEventsForClass",
    )

    # timetable.controller.ts — imports + mint method (anchor on my SMS-005a getOwnTimetable/text anchors)
    edit(
        BACKEND / "src/modules/timetable/timetable.controller.ts",
        'import { resolveSessionStudentId } from "@/middleware/self-access";\n',
        'import { resolveSessionStudentId } from "@/middleware/self-access";\n'
        'import { issueFeedToken } from "@/lib/calendar";\n'
        'import { AppError } from "@/middleware/error.handler";\n',
        "controller calendar imports",
        "issueFeedToken",
    )
    edit(
        BACKEND / "src/modules/timetable/timetable.controller.ts",
        "  public saveMatrix = async (",
        MINT_METHOD + "  public saveMatrix = async (",
        "mintCalendarToken method",
        "mintCalendarToken",
    )

    # timetable.routes.ts — mint route
    edit(
        BACKEND / "src/modules/timetable/timetable.routes.ts",
        'router.get("/matrix", requireRole(ROLES.ADMIN, ROLES.FACULTY), controller.getMatrix);\n',
        'router.get("/matrix", requireRole(ROLES.ADMIN, ROLES.FACULTY), controller.getMatrix);\n'
        '\n'
        '// SMS-010: mint signed .ics subscription links (feed itself is public + token-gated)\n'
        'router.post("/calendar/:classId/token", requireRole(ROLES.ADMIN, ROLES.FACULTY), controller.mintCalendarToken);\n',
        "calendar token mint route",
        "/calendar/:classId/token",
    )

    # app.ts — import + public mount BEFORE the authenticated timetable mount
    edit(
        BACKEND / "src/app.ts",
        "import timetableRoutes from './modules/timetable/timetable.routes';\n",
        "import timetableRoutes from './modules/timetable/timetable.routes';\n"
        "import calendarFeedRoutes from './modules/timetable/calendar-feed.routes';\n",
        "app calendar feed import",
        "calendarFeedRoutes",
    )
    edit(
        BACKEND / "src/app.ts",
        "app.use('/api/timetable', authenticate, timetableRoutes);\n",
        "// SMS-010: PUBLIC .ics feed — must mount BEFORE the authenticated timetable\n"
        "// mount; the stateless HMAC token in ?token= is the credential (calendar\n"
        "// apps cannot carry JWT cookies). Global apiLimiter still applies.\n"
        "app.use('/api/timetable/calendar', calendarFeedRoutes);\n"
        "app.use('/api/timetable', authenticate, timetableRoutes);\n",
        "app calendar feed mount",
        "app.use('/api/timetable/calendar'",
    )

    print()
    print("SMS-010 backend applied. Next: backend gates, then set CALENDAR_FEED_SECRET and smoke the feed.")


if __name__ == "__main__":
    main()
