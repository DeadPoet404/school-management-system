/**
 * SMS-013 — temporary credentials must leave the system by email only.
 *
 * The onboarding response previously carried `temporaryPassword` in its body.
 * These cases pin the replacement: the dispatcher is fail-soft, and the
 * service result never re-exposes the plaintext credential.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/mailer', () => ({
  isMailerConfigured: vi.fn(),
  sendMail: vi.fn(),
}));

import { isMailerConfigured, sendMail } from '@/lib/mailer';
import { dispatchTemporaryCredential } from '@/lib/credential-email';

const DISPATCH = {
  to: 'ama.mensah@school.edu.gh',
  recipientName: 'Ama Mensah',
  temporaryPassword: 'Sup3rSecretTemp',
};

describe('dispatchTemporaryCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports UNCONFIGURED without attempting a send when mail is not set up', async () => {
    vi.mocked(isMailerConfigured).mockReturnValue(false);

    const outcome = await dispatchTemporaryCredential(DISPATCH);

    expect(outcome.status).toBe('UNCONFIGURED');
    expect(sendMail).not.toHaveBeenCalled();
    expect(outcome.message).toMatch(/manual handover/i);
  });

  it('emails the credential to the teacher and reports SENT', async () => {
    vi.mocked(isMailerConfigured).mockReturnValue(true);
    vi.mocked(sendMail).mockResolvedValue({ sent: true });

    const outcome = await dispatchTemporaryCredential(DISPATCH);

    expect(outcome.status).toBe('SENT');
    const mail = vi.mocked(sendMail).mock.calls[0]![0];
    expect(mail.to).toBe(DISPATCH.to);
    // The credential belongs in the message body — that is the whole point.
    expect(mail.text).toContain(DISPATCH.temporaryPassword);
    expect(mail.html).toContain(DISPATCH.temporaryPassword);
  });

  it('never leaks the credential through the returned status message', async () => {
    vi.mocked(isMailerConfigured).mockReturnValue(true);
    vi.mocked(sendMail).mockResolvedValue({ sent: true });

    const outcome = await dispatchTemporaryCredential(DISPATCH);

    expect(outcome.message).not.toContain(DISPATCH.temporaryPassword);
  });

  it('degrades to FAILED when the provider rejects the message', async () => {
    vi.mocked(isMailerConfigured).mockReturnValue(true);
    vi.mocked(sendMail).mockResolvedValue({ sent: false, reason: 'smtp 550' });

    const outcome = await dispatchTemporaryCredential(DISPATCH);

    expect(outcome.status).toBe('FAILED');
    expect(outcome.message).not.toContain('smtp 550');
  });

  it('resolves rather than throws when the transport blows up', async () => {
    vi.mocked(isMailerConfigured).mockReturnValue(true);
    vi.mocked(sendMail).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(dispatchTemporaryCredential(DISPATCH)).resolves.toMatchObject({
      status: 'FAILED',
    });
  });

  it('escapes HTML metacharacters in the recipient name', async () => {
    vi.mocked(isMailerConfigured).mockReturnValue(true);
    vi.mocked(sendMail).mockResolvedValue({ sent: true });

    await dispatchTemporaryCredential({
      ...DISPATCH,
      recipientName: '<script>alert(1)</script>',
    });

    const mail = vi.mocked(sendMail).mock.calls[0]![0];
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});
