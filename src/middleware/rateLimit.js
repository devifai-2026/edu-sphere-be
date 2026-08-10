/**
 * Minimal in-memory fixed-window rate limiter — no extra dependency, no
 * shared store needed at this scale (single API instance). Keyed by IP +
 * an optional request field (e.g. phone) so one bad actor can't lock out
 * everyone else sharing a NAT'd IP.
 */
export function rateLimit({ windowMs, max, keyField } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return function (req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const extra = keyField ? String(req.body?.[keyField] || '') : '';
    const key = `${ip}:${extra}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: 'too many requests, try again later' });
    }
    next();
  };
}
