/**
 * Behavioral event ingest. The mobile app batches events and POSTs them here.
 * Auth: user JWT. Mounted at /api/track.
 *
 * Body: { events: [{ type, sessionId, screen?, query?, resultCount?,
 *                     durationMs?, platform?, appVersion?, ts? }] }
 */
import { Router } from 'express';
import { userAuth } from '../middleware/auth.js';
import { AnalyticsEvent, AnalyticsSession } from '../models/analytics.js';
import { User } from '../models/user.js';

const router = Router();

const MAX_BATCH = 100;

router.post('/', userAuth, async (req, res) => {
  const userId = req.user.sub;
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, MAX_BATCH) : [];
  if (events.length === 0) return res.status(400).json({ error: 'no events' });

  const now = new Date();
  const docs = [];
  for (const e of events) {
    if (!e || typeof e.type !== 'string') continue;
    docs.push({
      user: userId,
      sessionId: e.sessionId || '',
      type: e.type,
      screen: e.screen || '',
      query: (e.query || '').slice(0, 200),
      resultCount: Number(e.resultCount) || 0,
      durationMs: Number(e.durationMs) || 0,
      platform: e.platform || '',
      appVersion: e.appVersion || '',
      ts: e.ts ? new Date(e.ts) : now,
    });
  }
  if (docs.length === 0) return res.status(400).json({ error: 'no valid events' });

  try {
    await AnalyticsEvent.insertMany(docs, { ordered: false });

    // Maintain session rollups + user lastActiveAt.
    await Promise.all(
      dedupeSessions(docs).map(async (sid) => {
        const forSession = docs.filter((d) => d.sessionId === sid);
        const start = forSession.find((d) => d.type === 'session_start');
        const end = forSession.find((d) => d.type === 'session_end');
        const screenViews = forSession.filter((d) => d.type === 'screen_view').length;
        const searches = forSession.filter((d) => d.type === 'search').length;
        const sample = forSession[0];

        const set = { user: userId, platform: sample.platform, appVersion: sample.appVersion };
        // startedAt: prefer the session_start event; else set once on insert only.
        if (start) set.startedAt = start.ts;
        if (end) {
          set.endedAt = end.ts;
          set.durationMs = end.durationMs || 0;
        }
        const update = {
          $setOnInsert: { sessionId: sid },
          $set: set,
          $inc: { screenViews, searches },
        };
        // Only seed startedAt on insert when this batch has no explicit start.
        if (!start) update.$setOnInsert.startedAt = sample.ts;
        await AnalyticsSession.updateOne({ sessionId: sid }, update, { upsert: true });
      })
    );

    await User.updateOne({ _id: userId }, { $set: { lastActiveAt: now } });
    res.status(202).json({ accepted: docs.length });
  } catch (e) {
    console.error('[track] ingest failed:', e?.message || e);
    res.status(500).json({ error: 'ingest failed' });
  }
});

function dedupeSessions(docs) {
  return [...new Set(docs.map((d) => d.sessionId).filter(Boolean))];
}

export default router;
