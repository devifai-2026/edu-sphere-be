import { verify } from '../lib/jwt.js';
import { User } from '../models/user.js';

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/**
 * App/user auth — requires a valid user JWT. Also enforces block: a blocked
 * (disabled) or deleted user is rejected with 403 { code: 'blocked' } so the
 * app force-logs-out on the next API call.
 */
export async function userAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const claims = verify(token);
    if (claims.kind !== 'user') return res.status(401).json({ error: 'invalid token' });
    // Block/delete enforcement.
    const u = await User.findById(claims.sub).select('disabled').lean();
    if (!u) return res.status(403).json({ error: 'account removed', code: 'deleted' });
    if (u.disabled) return res.status(403).json({ error: 'account blocked', code: 'blocked' });
    req.user = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}

/** Admin auth — requires a valid admin JWT. */
export function adminAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const claims = verify(token);
    if (claims.kind !== 'admin') return res.status(403).json({ error: 'admin only' });
    req.admin = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}

/** Any authenticated principal — accepts a valid user OR admin JWT. */
export function anyAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const claims = verify(token);
    if (claims.kind === 'admin') req.admin = claims;
    else if (claims.kind === 'user') req.user = claims;
    else return res.status(401).json({ error: 'invalid token' });
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}

/** Optional user — attaches req.user if a valid token is present, else continues. */
export function optionalUser(req, _res, next) {
  const token = bearer(req);
  if (token) {
    try {
      const claims = verify(token);
      if (claims.kind === 'user') req.user = claims;
    } catch {
      /* ignore */
    }
  }
  next();
}
