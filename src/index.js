import { analyze } from './ai-provider.js';
export { Quota } from './quota.js';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const CTX = ['sensation', 'duration', 'change', 'treatment', 'notes'];
const DEFAULT_DAILY_LIMIT = 10;
function validate(b) {
  if (!b || b.consent !== true) return 'consent_required';
  if (typeof b.image !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b.image) || b.image.length > 4e6) return 'invalid_image';
  if (b.context && typeof b.context !== 'object') return 'invalid_context';
  return null;
}
async function visitorKey(req) {
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tvacha:' + ip));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function quotaCall(req, env, action) {
  const stub = env.QUOTA.get(env.QUOTA.idFromName(await visitorKey(req)));
  const limit = Number(env.DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  return (await stub.fetch(`https://quota/${action}?limit=${limit}`)).json();
}
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(async v => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(v)))));
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
const pub = q => ({ limit: q.limit, remaining: q.remaining, resetAt: q.resetAt });
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === '/api/quota') {
      if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
      if (!env.QUOTA) return json({ enabled: false });
      try { return json({ enabled: true, ...pub(await quotaCall(req, env, 'status')) }); }
      catch (e) { console.error('quota_status_error:', e.message); return json({ enabled: false }); }
    }
    if (u.pathname === '/api/admin/reset') {
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      if (!env.ADMIN_PASSWORD || !env.QUOTA) return json({ error: 'not_enabled' }, 404);
      if (env.ANALYZE_LIMITER) {
        const { success } = await env.ANALYZE_LIMITER.limit({ key: 'admin:' + (req.headers.get('CF-Connecting-IP') || 'unknown') });
        if (!success) return json({ error: 'rate_limited' }, 429);
      }
      let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
      if (!(await safeEqual(String(b?.password ?? ''), String(env.ADMIN_PASSWORD)))) return json({ error: 'forbidden' }, 403);
      try { return json({ ok: true, ...pub(await quotaCall(req, env, 'reset')) }); }
      catch (e) { console.error('quota_reset_error:', e.message); return json({ error: 'reset_failed' }, 500); }
    }
    if (u.pathname !== '/api/analyze') return env.ASSETS.fetch(req);
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    // Burst protection: short-window limit per visitor (see [[ratelimits]] in wrangler.toml).
    if (env.ANALYZE_LIMITER) {
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.ANALYZE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'rate_limited' }, 429);
    }
    let b; try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    const err = validate(b); if (err) return json({ error: err }, 400);
    const context = {};
    for (const k of CTX) if (b.context?.[k]) context[k] = String(b.context[k]).slice(0, 500);
    // Daily quota: reserve one analysis; give it back if the AI call fails.
    let quota = null;
    if (env.QUOTA) {
      try {
        quota = await quotaCall(req, env, 'consume');
        if (!quota.ok) return json({ error: 'quota_exceeded', ...pub(quota) }, 429);
      } catch (e) { console.error('quota_error:', e.message); quota = null; }
    }
    try {
      const out = await analyze(b.image, context, env);
      return json(quota ? { ...out, quota: pub(quota) } : out);
    } catch (e) {
      if (quota) { try { await quotaCall(req, env, 'refund'); } catch {} }
      console.error('provider_error:', e.message);
      return json({ error: 'provider_error' }, 502);
    }
  },
};
