import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { PaystackClient } from '@/modules/payments/paystack.client';

const SECRET = 'sk_test_abc123';

describe('PaystackClient.verifyWebhookSignature', () => {
  const body = Buffer.from('{"event":"charge.success","data":{"reference":"SMS-123"}}');

  it('accepts a valid HMAC-SHA512 signature', () => {
    const sig = createHmac('sha512', SECRET).update(body).digest('hex');
    const client = new PaystackClient(SECRET);
    expect(client.verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const sig = createHmac('sha512', SECRET).update(body).digest('hex');
    const client = new PaystackClient(SECRET);
    expect(client.verifyWebhookSignature(body, sig.slice(0, 126) + 'aa')).toBe(false);
  });

  it('rejects a non-hex / wrong-length signature', () => {
    const client = new PaystackClient(SECRET);
    expect(client.verifyWebhookSignature(body, 'not-hex')).toBe(false);
    expect(client.verifyWebhookSignature(body, 'ab'.repeat(64) + '!')).toBe(false);
  });

  it('rejects a missing signature', () => {
    const client = new PaystackClient(SECRET);
    expect(client.verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('rejects when the client is not configured', () => {
    const sig = createHmac('sha512', SECRET).update(body).digest('hex');
    const client = new PaystackClient('');
    expect(client.verifyWebhookSignature(body, sig)).toBe(false);
  });
});

describe('PaystackClient.initializeTransaction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns authorizationUrl/accessCode/reference on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          data: { authorization_url: 'https://pay', access_code: 'acc', reference: 'ref-1' },
        }),
      }),
    );
    const client = new PaystackClient(SECRET);
    const out = await client.initializeTransaction({
      email: 'a@b.c',
      amountInSubunit: 5000,
      currency: 'GHS',
      reference: 'ref-1',
      metadata: {},
    });
    expect(out.authorizationUrl).toBe('https://pay');
    expect(out.accessCode).toBe('acc');
    expect(out.reference).toBe('ref-1');
  });

  it('throws 503 when not configured (before any HTTP call)', async () => {
    const client = new PaystackClient('');
    await expect(
      client.initializeTransaction({ email: 'a@b.c', amountInSubunit: 1, currency: 'GHS', reference: 'r', metadata: {} }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
