import test from 'node:test'; import assert from 'node:assert/strict';
import { checkReport, analyze } from '../src/ai-provider.js'; import worker from '../src/index.js';
const good = { overview: { summary: 's' }, possibilities: [], care: {}, attention: { level: 'routine' } };

test('valid report passes', () => assert.equal(checkReport(good), good));
test('null report rejected', () => assert.throws(() => checkReport(null)));
test('unknown attention level rejected', () => assert.throws(() => checkReport({ ...good, attention: { level: 'urgent' } })));
test('possibilities must be an array', () => assert.throws(() => checkReport({ ...good, possibilities: 'x' })));
test('missing summary rejected', () => assert.throws(() => checkReport({ ...good, overview: {} })));
test('no API key gives labelled demo mode', async () => assert.equal((await analyze('AAAA', {}, {})).mode, 'demo'));
test('unknown provider is rejected', async () => await assert.rejects(analyze('AAAA', {}, { AI_API_KEY: 'k', AI_PROVIDER: 'nope' })));

const call = (body, method = 'POST') => worker.fetch(new Request('https://x/api/analyze', { method, body: body && JSON.stringify(body) }), { ASSETS: {} });
test('GET is rejected', async () => assert.equal((await call(null, 'GET')).status, 405));
test('missing consent is rejected', async () => assert.equal((await call({ image: 'AAAA' })).status, 400));
test('non-base64 image is rejected', async () => assert.equal((await call({ image: '<x>', consent: true })).status, 400));
test('oversized image is rejected', async () => assert.equal((await call({ image: 'A'.repeat(4e6 + 1), consent: true })).status, 400));
test('valid request without key returns demo', async () => { const r = await call({ image: 'AAAA', consent: true }); assert.equal(r.status, 200); assert.equal((await r.json()).mode, 'demo'); });

import { Quota } from '../src/quota.js';
const fakeCtx = () => { const m = new Map(); return { storage: { get: async k => m.get(k), put: async (k, v) => m.set(k, v), delete: async k => m.delete(k) } }; };
const q = (o, path, limit = 2) => o.fetch(new Request(`https://quota/${path}?limit=${limit}`)).then(r => r.json());

test('quota: consumes up to the limit then refuses', async () => {
  const o = new Quota(fakeCtx());
  assert.equal((await q(o, 'consume')).remaining, 1);
  assert.equal((await q(o, 'consume')).remaining, 0);
  const third = await q(o, 'consume');
  assert.equal(third.ok, false);
  assert.ok(third.resetAt > Date.now());
});
test('quota: refund gives an analysis back', async () => {
  const o = new Quota(fakeCtx());
  await q(o, 'consume'); await q(o, 'refund');
  assert.equal((await q(o, 'status')).remaining, 2);
});
test('quota: /api/quota without a binding is disabled, not an error', async () => {
  const r = await worker.fetch(new Request('https://x/api/quota'), { ASSETS: {} });
  assert.deepEqual(await r.json(), { enabled: false });
});
test('quota: exhausted visitor gets 429 quota_exceeded', async () => {
  const env = { ASSETS: {}, QUOTA: { idFromName: () => 'id', get: () => ({ fetch: async () => Response.json({ ok: false, limit: 10, remaining: 0, resetAt: Date.now() + 1000 }) }) } };
  const r = await worker.fetch(new Request('https://x/api/analyze', { method: 'POST', body: JSON.stringify({ image: 'AAAA', consent: true }) }), env);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'quota_exceeded');
});

test('quota: reset clears the counter', async () => {
  const o = new Quota(fakeCtx());
  await q(o, 'consume'); await q(o, 'consume');
  assert.equal((await q(o, 'reset')).remaining, 2);
});
const adminCall = (password, env) => worker.fetch(new Request('https://x/api/admin/reset', { method: 'POST', body: JSON.stringify({ password }) }), env);
const quotaEnv = (extra = {}) => ({ ASSETS: {}, QUOTA: { idFromName: () => 'id', get: () => ({ fetch: async () => Response.json({ ok: true, limit: 10, remaining: 10, resetAt: null }) }) }, ...extra });
test('admin reset: disabled when no password is configured', async () => assert.equal((await adminCall('x', quotaEnv())).status, 404));
test('admin reset: wrong password is refused', async () => assert.equal((await adminCall('nope', quotaEnv({ ADMIN_PASSWORD: 'secret' }))).status, 403));
test('admin reset: right password resets', async () => {
  const r = await adminCall('secret', quotaEnv({ ADMIN_PASSWORD: 'secret' }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).remaining, 10);
});
