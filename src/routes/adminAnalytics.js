/**
 * Admin analytics aggregation. Mounted under /admin (behind adminAuth).
 * Powers the dashboard graphs and enriched Users view.
 */
import { Router } from 'express';
import { AnalyticsEvent, AnalyticsSession } from '../models/analytics.js';
import { User } from '../models/user.js';
import { Application } from '../models/content.js';
import { TestAttempt } from '../models/testAttempt.js';
import { Feedback } from '../models/feedback.js';

const router = Router();

/** Parse ?days=N (default 30, max 365) into a start Date. */
function rangeStart(req) {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return { start: d, days };
}
const dayKey = { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } };

/* ---------- Overview KPIs ---------- */
router.get('/analytics/overview', async (req, res) => {
  const { start } = rangeStart(req);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [totalUsers, newUsers, activeToday, activeWeek, sessionAgg, searchCount] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: start } }),
    User.countDocuments({ lastActiveAt: { $gte: dayAgo } }),
    User.countDocuments({ lastActiveAt: { $gte: weekAgo } }),
    AnalyticsSession.aggregate([
      { $match: { startedAt: { $gte: start } } },
      { $group: { _id: null, sessions: { $sum: 1 }, totalMs: { $sum: '$durationMs' }, avgMs: { $avg: '$durationMs' } } },
    ]),
    AnalyticsEvent.countDocuments({ type: 'search', ts: { $gte: start } }),
  ]);
  const s = sessionAgg[0] || { sessions: 0, totalMs: 0, avgMs: 0 };
  res.json({
    totalUsers,
    newUsers,
    activeToday,
    activeWeek,
    sessions: s.sessions,
    totalTimeMs: s.totalMs,
    avgSessionMs: Math.round(s.avgMs || 0),
    searches: searchCount,
  });
});

/* ---------- Timeseries: new users, active users, sessions, searches per day ---------- */
router.get('/analytics/timeseries', async (req, res) => {
  const { start, days } = rangeStart(req);

  const [newUsersByDay, sessionsByDay, searchesByDay, activeByDay] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    AnalyticsSession.aggregate([
      { $match: { startedAt: { $gte: start } } },
      { $group: { _id: dayKey, sessions: { $sum: 1 }, minutes: { $sum: { $divide: ['$durationMs', 60000] } } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { type: 'search', ts: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, n: { $sum: 1 } } },
    ]),
    AnalyticsSession.aggregate([
      { $match: { startedAt: { $gte: start } } },
      { $group: { _id: { day: dayKey, user: '$user' } } },
      { $group: { _id: '$_id.day', users: { $sum: 1 } } },
    ]),
  ]);

  const map = (arr, k) => Object.fromEntries(arr.map((r) => [r._id, r[k]]));
  const nu = map(newUsersByDay, 'n');
  const sd = Object.fromEntries(sessionsByDay.map((r) => [r._id, r]));
  const sc = map(searchesByDay, 'n');
  const au = map(activeByDay, 'users');

  const out = [];
  const cur = new Date(start);
  for (let i = 0; i < days; i++) {
    const key = cur.toISOString().slice(0, 10);
    out.push({
      date: key,
      newUsers: nu[key] || 0,
      activeUsers: au[key] || 0,
      sessions: sd[key]?.sessions || 0,
      minutes: Math.round(sd[key]?.minutes || 0),
      searches: sc[key] || 0,
    });
    cur.setDate(cur.getDate() + 1);
  }
  res.json(out);
});

/* ---------- Top searches ---------- */
router.get('/analytics/top-searches', async (req, res) => {
  const { start } = rangeStart(req);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const rows = await AnalyticsEvent.aggregate([
    { $match: { type: 'search', ts: { $gte: start }, query: { $ne: '' } } },
    { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  res.json(rows.map((r) => ({ query: r._id, count: r.count })));
});

/* ---------- Screen popularity ---------- */
router.get('/analytics/top-screens', async (req, res) => {
  const { start } = rangeStart(req);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  const rows = await AnalyticsEvent.aggregate([
    { $match: { type: 'screen_view', ts: { $gte: start }, screen: { $ne: '' } } },
    { $group: { _id: '$screen', views: { $sum: 1 }, users: { $addToSet: '$user' } } },
    { $project: { views: 1, users: { $size: '$users' } } },
    { $sort: { views: -1 } },
    { $limit: limit },
  ]);
  res.json(rows.map((r) => ({ screen: r._id, views: r.views, users: r.users })));
});

/* ---------- Activity feed (recent events across the platform) ---------- */
router.get('/analytics/activity', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
  const [newUsers, attempts, apps, feedback] = await Promise.all([
    User.find().sort('-createdAt').limit(limit).select('firstName lastName phone createdAt').lean(),
    TestAttempt.find().sort('-createdAt').limit(limit).populate('user', 'firstName lastName phone').lean(),
    Application.find().sort('-createdAt').limit(limit).populate('user', 'firstName lastName').populate('job', 'role').lean(),
    Feedback.find().sort('-createdAt').limit(limit).populate('user', 'firstName lastName').lean(),
  ]);
  const uname = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.phone : 'Someone');
  const feed = [
    ...newUsers.map((u) => ({ type: 'new_user', icon: 'person-add', text: `${uname(u)} onboarded`, at: u.createdAt })),
    ...attempts.map((a) => ({ type: 'test_attempt', icon: 'clipboard', text: `${uname(a.user)} scored ${a.percent}% on ${a.testTitle}`, at: a.createdAt })),
    ...apps.map((a) => ({ type: 'application', icon: 'briefcase', text: `${uname(a.user)} applied to ${a.job?.role || 'a job'}`, at: a.createdAt })),
    ...feedback.map((f) => ({ type: 'feedback', icon: 'chatbubble', text: `${uname(f.user)} left feedback (${f.category})`, at: f.createdAt })),
  ]
    .filter((x) => x.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
  res.json(feed);
});

/* ---------- Per-user activity detail ---------- */
router.get('/analytics/user/:id', async (req, res) => {
  const id = req.params.id;
  const [user, sessionAgg, screens, searches, recent, applications] = await Promise.all([
    User.findById(id).lean(),
    AnalyticsSession.aggregate([
      { $match: { user: toId(id) } },
      { $group: { _id: null, sessions: { $sum: 1 }, totalMs: { $sum: '$durationMs' }, avgMs: { $avg: '$durationMs' } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { user: toId(id), type: 'screen_view' } },
      { $group: { _id: '$screen', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { user: toId(id), type: 'search', query: { $ne: '' } } },
      { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    AnalyticsEvent.find({ user: toId(id) }).sort({ ts: -1 }).limit(40).lean(),
    Application.find({ user: toId(id) }).sort('-createdAt').populate('job', 'role company').lean(),
  ]);
  if (!user) return res.status(404).json({ error: 'not found' });
  const s = sessionAgg[0] || { sessions: 0, totalMs: 0, avgMs: 0 };
  res.json({
    user: {
      id: user._id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone,
      email: user.email,
      college: user.college,
      degree: user.degree,
      stream: user.stream,
      year: user.year,
      skills: user.skills || [],
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      testsCompleted: user.testsCompleted || 0,
      placementScore: user.placementScore || 0,
      cvUrl: user.cvUrl || '',
      cvName: user.cvName || '',
    },
    // Portfolio with images so the admin can view certificate/project photos.
    projects: (user.projects || []).map((p) => ({ id: String(p._id), title: p.title, meta: p.meta, stars: p.stars, icon: p.icon, imageUrl: p.imageUrl || '' })),
    certificates: (user.certificates || []).map((c) => ({ id: String(c._id), title: c.title, issuer: c.issuer, year: c.year, icon: c.icon, imageUrl: c.imageUrl || '' })),
    applications: applications.map((a) => ({
      id: String(a._id),
      status: a.status,
      appliedAt: a.createdAt,
      cvUrl: a.cvUrl,
      cvName: a.cvName,
      job: a.job ? { id: String(a.job._id), role: a.job.role, company: a.job.company } : null,
    })),
    sessions: s.sessions,
    totalTimeMs: s.totalMs,
    avgSessionMs: Math.round(s.avgMs || 0),
    topScreens: screens.map((r) => ({ screen: r._id, views: r.views })),
    topSearches: searches.map((r) => ({ query: r._id, count: r.count })),
    recent: recent.map((e) => ({
      type: e.type,
      screen: e.screen,
      query: e.query,
      durationMs: e.durationMs,
      ts: e.ts,
    })),
  });
});

import mongoose from 'mongoose';
function toId(id) {
  return new mongoose.Types.ObjectId(id);
}

export default router;
