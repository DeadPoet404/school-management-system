/**
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
  return value
    .replace(/\\/g, '\\\\')   // backslash first -- order matters
    .replace(/;/g, '\\;')     // RFC 5545 section 4.3.11 TEXT escaping
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');   // literal LF -> two-char \n sequence
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
  return parts.join('\r\n');
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
  return lines.join('\r\n') + '\r\n';
}
