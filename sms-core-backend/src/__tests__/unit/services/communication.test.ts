/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use any for flexibility */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { prismaMock, mailerSendMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn((arg: any) =>
      typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
    ),
    student: { findMany: vi.fn() },
    placement: { findMany: vi.fn() },
    class: { findUnique: vi.fn() },
    announcement: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    notificationDelivery: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  },
  mailerSendMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/mailer', () => ({
  sendMail: mailerSendMock,
  isMailerConfigured: () => mailerConfigured,
}));

let mailerConfigured = false;

import {
  ArkeselSmsAdapter,
  MetaWhatsAppAdapter,
  EmailAdapter,
  type ChannelAdapter,
} from '@/modules/communication/communication.adapters';
import { NotificationDispatchWorker } from '@/modules/communication/communication.worker';
import { CommunicationService } from '@/modules/communication/communication.service';
import { requireRole, ROLES } from '@/middleware/rbac.middleware';
import { AuthenticatedRequest } from '@/middleware/auth.middleware';
import { AppError } from '@/middleware/error.handler';

const ENV_KEYS = [
  'ARKESEL_API_KEY',
  'ARKESEL_SENDER_ID',
  'META_WA_PHONE_NUMBER_ID',
  'META_WA_ACCESS_TOKEN',
  'META_WA_BUSINESS_ACCOUNT_ID',
];
const savedEnv: Record<string, string | undefined> = {};
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const service = new CommunicationService();

function stubAdapter(ok: boolean, extra: Partial<ChannelAdapter> = {}): ChannelAdapter {
  return {
    channel: 'SMS',
    isConfigured: () => true,
    send: vi.fn(async () =>
      ok ? { ok: true, providerMessageId: 'prov-1' } : { ok: false, error: 'boom' },
    ),
    ...extra,
  } as ChannelAdapter;
}

beforeEach(() => {
  vi.clearAllMocks();
  mailerConfigured = false;
  for (const key of ENV_KEYS) {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  prismaMock.student.findMany.mockResolvedValue([]);
  prismaMock.placement.findMany.mockResolvedValue([]);
  prismaMock.class.findUnique.mockResolvedValue(null);
  prismaMock.announcement.create.mockResolvedValue({ id: 'ann-1', status: 'QUEUED', audience: 'SCHOOL_WIDE' });
  prismaMock.announcement.findMany.mockResolvedValue([]);
  prismaMock.announcement.findUnique.mockResolvedValue(null);
  prismaMock.announcement.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.notificationDelivery.findMany.mockResolvedValue([]);
  prismaMock.notificationDelivery.createMany.mockResolvedValue({ count: 0 });
  prismaMock.notificationDelivery.update.mockResolvedValue({});
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

describe('channel adapters (SMS-012)', () => {
  it('Arkesel: unconfigured short-circuits without HTTP', async () => {
    const adapter = new ArkeselSmsAdapter();
    const outcome = await adapter.send({ to: '0244000000', text: 'hi' });
    expect(outcome).toEqual({ ok: false, error: 'adapter-not-configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Arkesel: posts the v2 payload with api-key header and maps data[0].id', async () => {
    process.env.ARKESEL_API_KEY = 'ark-key';
    process.env.ARKESEL_SENDER_ID = 'Horizon';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', data: [{ id: 'ark-msg-9' }] }),
    });

    const outcome = await new ArkeselSmsAdapter().send({ to: '0244000000', text: 'Reopen Monday' });

    expect(outcome).toEqual({ ok: true, providerMessageId: 'ark-msg-9' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://sms.arkesel.com/api/v2/sms/send');
    expect(init.headers['api-key']).toBe('ark-key');
    expect(JSON.parse(init.body)).toEqual({
      sender: 'Horizon',
      message: 'Reopen Monday',
      recipients: ['0244000000'],
    });
  });

  it('Arkesel: non-2xx surfaces a bounded provider error', async () => {
    process.env.ARKESEL_API_KEY = 'ark-key';
    process.env.ARKESEL_SENDER_ID = 'Horizon';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ status: 'error' }),
    });
    const outcome = await new ArkeselSmsAdapter().send({ to: 'x', text: 'y' });
    expect(outcome.ok).toBe(false);
    expect(String(outcome.error)).toContain('401');
  });

  it('Meta WA: posts text payload to the phone-number endpoint, maps messages[0].id', async () => {
    process.env.META_WA_PHONE_NUMBER_ID = 'pn-1';
    process.env.META_WA_ACCESS_TOKEN = 'tok';
    process.env.META_WA_BUSINESS_ACCOUNT_ID = 'waba-1';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.42' }] }),
    });

    const outcome = await new MetaWhatsAppAdapter().send({ to: '233244000000', text: 'Notice' });

    expect(outcome).toEqual({ ok: true, providerMessageId: 'wamid.42' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://graph.facebook.com/v19.0/pn-1/messages');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '233244000000',
      type: 'text',
      text: { body: 'Notice' },
    });
  });

  it('Email: delegates to the SMS-006 mailer (never throws)', async () => {
    mailerConfigured = true;
    mailerSendMock.mockResolvedValue({ sent: true });
    const outcome = await new EmailAdapter().send({ to: 'g@x.com', subject: 'Hi', text: 'Body' });
    expect(outcome).toEqual({ ok: true });
    expect(mailerSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'g@x.com', subject: 'Hi', text: 'Body' }),
    );
  });
});

describe('recipient resolution (SMS-012)', () => {
  const students = [
    {
      id: 's1',
      studentId: 'HHA-2024-0001',
      studentName: 'Ama Yaw Osei',
      guardians: [
        { name: 'Mama Osei', phone: '0244000001', email: 'mama@x.com' },
        { name: 'Papa Osei', phone: '0244000002', email: null },
      ],
      account: { portalEmail: 'student001@horizon.local' },
    },
  ];

  it('SMS/WHATSAPP use guardian phones; EMAIL uses guardian emails + portal email', () => {
    const rows = service.buildRecipients(students as any, ['SMS', 'WHATSAPP', 'EMAIL']);
    const byChannel = (c: string) => rows.filter((r) => r.channel === c).map((r) => r.recipient);
    expect(byChannel('SMS')).toEqual(['0244000001', '0244000002']);
    expect(byChannel('WHATSAPP')).toEqual(['0244000001', '0244000002']);
    expect(byChannel('EMAIL')).toEqual(['mama@x.com', 'student001@horizon.local']);
  });

  it('dedupes a shared guardian email across students', () => {
    const twin = { ...students[0]!, id: 's2' };
    const rows = service.buildRecipients([students[0]!, twin] as any, ['EMAIL']);
    expect(rows.filter((r) => r.recipient === 'mama@x.com')).toHaveLength(1);
    expect(rows.filter((r) => r.recipient === 'student001@horizon.local')).toHaveLength(1);
  });

  it('CLASS audience 404s an unknown class; STUDENTS audience 400s zero matches', async () => {
    await expect(
      service.compose(
        { title: 't', body: 'b', audience: 'CLASS', classId: 'ghost', channels: ['SMS'] },
        { id: 'u1', email: 'admin@sms.local' },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      service.compose(
        { title: 't', body: 'b', audience: 'STUDENTS', studentIds: ['nobody'], channels: ['SMS'] },
        { id: 'u1', email: 'admin@sms.local' },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('compose persists announcement + ledger rows in one transaction', async () => {
    prismaMock.student.findMany.mockResolvedValue(students);

    const result = await service.compose(
      { title: 'Reopen', body: 'Monday 07:30', audience: 'SCHOOL_WIDE', channels: ['SMS', 'EMAIL'] },
      { id: 'u1', email: 'admin@sms.local' },
    );

    expect(result).toMatchObject({
      announcementId: 'ann-1',
      recipientCount: 4,
      channelCounts: { SMS: 2, EMAIL: 2 },
    });
    expect(prismaMock.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audience: 'SCHOOL_WIDE',
          channels: ['SMS', 'EMAIL'],
          createdBy: 'u1',
          createdByEmail: 'admin@sms.local',
        }),
      }),
    );
    const ledger = prismaMock.notificationDelivery.createMany.mock.calls[0]![0] as any;
    expect(ledger.data).toHaveLength(4);
    expect(ledger.data.map((d: any) => d.channel).sort()).toEqual(['EMAIL', 'EMAIL', 'SMS', 'SMS']);
  });
});

describe('dispatch worker (SMS-012)', () => {
  const dueRow = (over: Record<string, unknown> = {}) => ({
    id: 'd1',
    channel: 'SMS',
    recipient: '0244000001',
    attempts: 0,
    announcement: { title: 'Reopen', body: 'Monday 07:30' },
    ...over,
  });

  const makeWorker = (adapters: any) =>
    new NotificationDispatchWorker({ adapters, maxPerRun: 10 });

  it('sends due rows and captures the provider message id', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow()]);
    const worker = makeWorker({ SMS: stubAdapter(true) });
    const summary = await worker.processDue(new Date('2026-08-05T10:00:00Z'));

    expect(summary).toEqual({ claimed: 1, sent: 1, failed: 0, retried: 0 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data).toMatchObject({
      status: 'SENT',
      attempts: 1,
      providerMessageId: 'prov-1',
    });
    expect(prismaMock.announcement.updateMany).toHaveBeenCalledTimes(2);
  });

  it('failed send requeues with the 1-minute first backoff rung', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow()]);
    const worker = makeWorker({ SMS: stubAdapter(false) });
    const now = new Date('2026-08-05T10:00:00Z');
    const summary = await worker.processDue(now);

    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 0, retried: 1 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data.status).toBe('QUEUED');
    expect(update.data.attempts).toBe(1);
    expect(update.data.nextAttemptAt.getTime() - now.getTime()).toBe(60_000);
  });

  it('the 5th failure marks the delivery terminally FAILED', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow({ attempts: 4 })]);
    const worker = makeWorker({ SMS: stubAdapter(false) });
    const summary = await worker.processDue(new Date());

    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 1, retried: 0 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data.status).toBe('FAILED');
    expect(update.data.attempts).toBe(5);
  });

  it('unconfigured channel fails permanently with channel-disabled (no retry)', async () => {
    prismaMock.notificationDelivery.findMany.mockResolvedValue([dueRow({ channel: 'EMAIL' })]);
    const worker = makeWorker({ EMAIL: { channel: 'EMAIL', isConfigured: () => false, send: vi.fn() } });
    const summary = await worker.processDue(new Date());

    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 1, retried: 0 });
    const update = prismaMock.notificationDelivery.update.mock.calls[0]![0] as any;
    expect(update.data).toMatchObject({ status: 'FAILED', error: 'channel-disabled' });
  });
});

describe('communication route role matrix (SMS-012)', () => {
  const mockRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

  it('compose is ADMIN-only (STAFF rejected)', () => {
    const guard = requireRole(ROLES.ADMIN);
    const next = vi.fn();
    guard({ user: { role: 'STAFF' } } as AuthenticatedRequest, mockRes() as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next.mock.calls[0]![0]! as AppError).statusCode).toBe(403);
  });

  it('ledger reads allow ADMIN and STAFF, reject FACULTY', () => {
    const guard = requireRole(ROLES.ADMIN, ROLES.STAFF);
    let next = vi.fn();
    guard({ user: { role: 'STAFF' } } as AuthenticatedRequest, mockRes() as any, next);
    expect(next).toHaveBeenCalledWith();
    next = vi.fn();
    guard({ user: { role: 'FACULTY' } } as AuthenticatedRequest, mockRes() as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect((next.mock.calls[0]![0]! as AppError).statusCode).toBe(403);
  });
});
