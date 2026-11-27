// Daily usage quota. One Durable Object per visitor (keyed by a hash of their network address).
// The 24h window starts at the visitor's first analysis and resets when it ends.
const WINDOW_MS = 24 * 60 * 60 * 1000;

export class Quota {
  constructor(ctx) { this.ctx = ctx; }
  async fetch(req) {
    const url = new URL(req.url);
    const limit = Math.max(1, Number(url.searchParams.get('limit')) || 10);
    const now = Date.now();
    let s = (await this.ctx.storage.get('s')) || { used: 0, resetAt: null };
    if (s.resetAt && now >= s.resetAt) s = { used: 0, resetAt: null };
    let ok = true;
    if (url.pathname === '/consume') {
      if (s.used >= limit) ok = false;
      else {
        s.used++;
        if (!s.resetAt) s.resetAt = now + WINDOW_MS;
        await this.ctx.storage.put('s', s);
      }
    } else if (url.pathname === '/reset') {
      await this.ctx.storage.delete('s');
      s = { used: 0, resetAt: null };
    } else if (url.pathname === '/refund') {
      if (s.used > 0) {
        s.used--;
        if (s.used === 0) s.resetAt = null;
        await this.ctx.storage.put('s', s);
      }
    }
    return Response.json({ ok, limit, remaining: Math.max(0, limit - s.used), resetAt: s.used > 0 ? s.resetAt : null });
  }
}
