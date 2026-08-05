import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//School Management System//Class Timetable Feeds//EN');
    expect(ics).toContain('X-WR-CALNAME:JHS 1A Timetable');
    expect(ics).toContain('END:VCALENDAR\r\n');
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
    expect(ics).toContain('SUMMARY:Break\\, Team Meet — Morning Break');
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
