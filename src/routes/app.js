import { Router } from 'express';
import { PUBLIC_FILTER } from '../models/publishable.js';
import { College, Stream, Year, Degree, Subject, SubjectEligibility, Chapter, Topic, Video } from '../models/catalog.js';
import { Test } from '../models/tests.js';
import { PYQ } from '../models/pyq.js';
import { Note } from '../models/notes.js';
import { Announcement, Banner, Job, Notification, Faq, ResumeConfig, Application } from '../models/content.js';
import { Feedback } from '../models/feedback.js';
import { TestAttempt } from '../models/testAttempt.js';
import { Group, ChatMessage, GroupMembershipLog } from '../models/community.js';
import { ThemeConfig } from '../models/theme.js';
import { User } from '../models/user.js';
import { userAuth, optionalUser } from '../middleware/auth.js';
import * as S from '../lib/serialize.js';

const router = Router();

/* ---------- reference lists (onboarding pickers) ---------- */
router.get('/refs', async (_req, res) => {
  const [colleges, streams, years, degrees] = await Promise.all([
    College.find().sort('order name').lean(),
    Stream.find().sort('order name').lean(),
    Year.find().sort('order name').lean(),
    Degree.find().sort('order name').lean(),
  ]);
  res.json({
    colleges: colleges.map((c) => c.name),
    streams: streams.map((s) => s.name),
    years: years.map((y) => y.name),
    degrees: degrees.map((d) => d.name),
  });
});

/* ---------- catalog: getSubjects(college, stream, year) ---------- */
router.get('/subjects', async (req, res) => {
  const { college, stream, year } = req.query;
  const [streamDoc, yearDoc] = await Promise.all([
    Stream.findOne({ name: stream }).lean(),
    Year.findOne({ name: year }).lean(),
  ]);
  if (!streamDoc || !yearDoc) return res.json([]);
  const collegeDoc = college ? await College.findOne({ name: college }).lean() : null;

  // exact (collegeId) wins, else wildcard (collegeId null) — mirrors getSubjects resolution.
  const base = { streamId: streamDoc._id, yearId: yearDoc._id };
  let rules = collegeDoc
    ? await SubjectEligibility.find({ ...base, collegeId: collegeDoc._id }).sort('order').lean()
    : [];
  if (!rules.length) rules = await SubjectEligibility.find({ ...base, collegeId: null }).sort('order').lean();

  const subjectIds = rules.map((r) => r.subjectId);
  const subjects = await Subject.find({ _id: { $in: subjectIds }, ...PUBLIC_FILTER }).lean();
  const bySlugOrder = new Map(subjectIds.map((id, i) => [String(id), i]));
  subjects.sort((a, b) => bySlugOrder.get(String(a._id)) - bySlugOrder.get(String(b._id)));
  res.json(subjects.map(S.subject));
});

/** subjectsByIds — resolve chosen subject slugs to full objects (student's subjects). */
router.get('/subjects/by-slugs', async (req, res) => {
  const slugs = String(req.query.slugs || '').split(',').filter(Boolean);
  const subjects = await Subject.find({ slug: { $in: slugs }, ...PUBLIC_FILTER }).lean();
  const order = new Map(slugs.map((s, i) => [s, i]));
  subjects.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  res.json(subjects.map(S.subject));
});

/* ---------- getChapters(subjectSlug) → nested topics + videos ---------- */
router.get('/subjects/:slug/chapters', async (req, res) => {
  const subject = await Subject.findOne({ slug: req.params.slug, ...PUBLIC_FILTER }).lean();
  if (!subject) return res.json([]);
  const chapters = await Chapter.find({ subjectId: subject._id, ...PUBLIC_FILTER }).sort('order').lean();
  const out = [];
  for (const ch of chapters) {
    const topics = await Topic.find({ chapterId: ch._id, ...PUBLIC_FILTER }).sort('order').lean();
    const topicOut = [];
    for (const t of topics) {
      const videos = await Video.find({ topicId: t._id, ...PUBLIC_FILTER }).sort('order').lean();
      topicOut.push(S.topic(t, videos));
    }
    out.push(S.chapter(ch, subject.slug, topicOut));
  }
  res.json(out);
});

/* ---------- findVideo(videoId) ---------- */
router.get('/videos/:id', async (req, res) => {
  const v = await Video.findOne({ _id: req.params.id, ...PUBLIC_FILTER }).lean();
  if (!v) return res.status(404).json({ error: 'not found' });
  const subject = await Subject.findById(v.subjectId).lean();
  res.json({ video: S.video(v), subjectId: subject?.slug ?? '' });
});

/* ---------- getPYQs(subjectSlug) ---------- */
router.get('/subjects/:slug/pyqs', async (req, res) => {
  const subject = await Subject.findOne({ slug: req.params.slug }).lean();
  if (!subject) return res.json([]);
  const pyqs = await PYQ.find({ subjectId: subject._id, ...PUBLIC_FILTER }).sort('-examYear').lean();
  res.json(pyqs.map(S.pyq));
});

/* ---------- getNotes(subjectSlug) — first-class subject notes ---------- */
router.get('/subjects/:slug/notes', async (req, res) => {
  const notes = await Note.find({ subjectSlug: req.params.slug, ...PUBLIC_FILTER }).sort('order').lean();
  res.json(notes.map(S.note));
});

/* ---------- eligibleTests(year, stream) ---------- */
router.get('/tests', async (req, res) => {
  const { stream, year } = req.query;
  const filter = { ...PUBLIC_FILTER };
  if (stream) {
    const s = await Stream.findOne({ name: stream }).lean();
    if (s) filter.streamId = s._id;
  }
  if (year) {
    const y = await Year.findOne({ name: year }).lean();
    if (y) filter.yearId = y._id;
  }
  const tests = await Test.find(filter).lean();
  const [streams, years] = await Promise.all([Stream.find().lean(), Year.find().lean()]);
  const sName = Object.fromEntries(streams.map((s) => [String(s._id), s.name]));
  const yName = Object.fromEntries(years.map((y) => [String(y._id), y.name]));
  res.json(tests.map((t) => S.test(t, sName[String(t.streamId)], yName[String(t.yearId)])));
});

router.get('/tests/:id', async (req, res) => {
  const t = await Test.findOne({ _id: req.params.id, ...PUBLIC_FILTER }).lean();
  if (!t) return res.status(404).json({ error: 'not found' });
  const [s, y] = await Promise.all([Stream.findById(t.streamId).lean(), Year.findById(t.yearId).lean()]);
  res.json(S.test(t, s?.name, y?.name));
});

/* ---------- flat content lists ---------- */
router.get('/announcements', async (_req, res) => {
  const a = await Announcement.find(PUBLIC_FILTER).sort('-publishedAt -createdAt').lean();
  res.json(a.map(S.announcement));
});
router.get('/banners', async (_req, res) => {
  const b = await Banner.find(PUBLIC_FILTER).sort('order').lean();
  res.json(b.map(S.banner));
});
router.get('/jobs', async (_req, res) => {
  const j = await Job.find(PUBLIC_FILTER).sort('-createdAt').lean();
  res.json(j.map(S.job));
});
router.get('/faqs', async (_req, res) => {
  const f = await Faq.find(PUBLIC_FILTER).sort('order').lean();
  res.json(f.map(S.faq));
});
router.get('/groups', optionalUser, async (req, res) => {
  const g = await Group.find(PUBLIC_FILTER).sort('-official -members').lean();
  const uid = req.user?.sub;
  res.json(g.map((x) => ({ ...S.group(x), recommended: !!x.recommended, joined: uid ? (x.memberIds || []).some((m) => String(m) === String(uid)) : false })));
});

/** Join a group (students only). */
router.post('/groups/:id/join', userAuth, async (req, res) => {
  const already = await Group.exists({ _id: req.params.id, memberIds: req.user.sub });
  const g = await Group.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { memberIds: req.user.sub } },
    { new: true }
  );
  if (!g) return res.status(404).json({ error: 'group not found' });
  await Group.updateOne({ _id: g._id }, { $set: { members: (g.memberIds || []).length } });
  if (!already) {
    const u = await User.findById(req.user.sub).select('firstName lastName').lean();
    await GroupMembershipLog.create({ group: g._id, groupName: g.name, user: req.user.sub, userName: `${u?.firstName || ''} ${u?.lastName || ''}`.trim(), action: 'join', by: 'user' });
  }
  res.json({ ok: true, joined: true });
});
router.post('/groups/:id/leave', userAuth, async (req, res) => {
  const was = await Group.exists({ _id: req.params.id, memberIds: req.user.sub });
  const g = await Group.findByIdAndUpdate(
    req.params.id,
    { $pull: { memberIds: req.user.sub } },
    { new: true }
  );
  if (!g) return res.status(404).json({ error: 'group not found' });
  await Group.updateOne({ _id: g._id }, { $set: { members: (g.memberIds || []).length } });
  if (was) {
    const u = await User.findById(req.user.sub).select('firstName lastName').lean();
    await GroupMembershipLog.create({ group: g._id, groupName: g.name, user: req.user.sub, userName: `${u?.firstName || ''} ${u?.lastName || ''}`.trim(), action: 'leave', by: 'user' });
  }
  res.json({ ok: true, joined: false });
});

/** Group messages — members only see them. */
router.get('/groups/:id/messages', userAuth, async (req, res) => {
  const g = await Group.findById(req.params.id).lean();
  if (!g) return res.status(404).json({ error: 'group not found' });
  const isMember = (g.memberIds || []).some((m) => String(m) === String(req.user.sub));
  if (!isMember) return res.status(403).json({ error: 'join the group to view messages' });
  const msgs = await ChatMessage.find({ groupId: req.params.id, deleted: { $ne: true } }).sort('createdAt').limit(200).lean();
  res.json(msgs.map((m) => ({
    id: String(m._id),
    text: m.text,
    kind: m.kind || 'text',
    imageUrl: m.imageUrl || '',
    fromAdmin: !!m.fromAdmin,
    senderName: m.fromAdmin ? 'Admin' : m.senderName,
    mine: String(m.senderId) === String(req.user.sub),
    time: m.createdAt,
  })));
});

/** Post a message — students may send TEXT ONLY (no images). */
router.post('/groups/:id/messages', userAuth, async (req, res) => {
  const g = await Group.findById(req.params.id).lean();
  if (!g) return res.status(404).json({ error: 'group not found' });
  const isMember = (g.memberIds || []).some((m) => String(m) === String(req.user.sub));
  if (!isMember) return res.status(403).json({ error: 'join the group to post' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  const u = await User.findById(req.user.sub).select('firstName lastName').lean();
  const msg = await ChatMessage.create({
    groupId: req.params.id,
    senderId: req.user.sub,
    senderName: `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || 'Student',
    kind: 'text', // students are text-only
    text,
  });
  await Group.updateOne({ _id: req.params.id }, { $set: { lastMsg: text.slice(0, 80) } });
  res.status(201).json({ id: String(msg._id), ok: true });
});
router.get('/resume-config', async (_req, res) => {
  const rc = (await ResumeConfig.findOne({ key: 'default' }).lean()) || { suggestions: [], missing: [] };
  res.json({ suggestions: rc.suggestions, missing: rc.missing });
});

/* ---------- theme ---------- */
router.get('/theme', async (_req, res) => {
  const t = (await ThemeConfig.findOne({ active: true }).lean()) || { colors: {}, gradients: {}, tokens: {} };
  res.json({ colors: t.colors || {}, gradients: t.gradients || {}, tokens: t.tokens || {} });
});

/* ---------- notifications (broadcast + per-user), requires auth ---------- */
router.get('/notifications', userAuth, async (req, res) => {
  const n = await Notification.find({ ...PUBLIC_FILTER, $or: [{ userId: null }, { userId: req.user.sub }] })
    .sort('-createdAt')
    .lean();
  res.json(n.map(S.notification));
});

/* ---------- current user ---------- */
router.get('/users/me', userAuth, async (req, res) => {
  const u = await User.findById(req.user.sub).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json(S.userProfile(u));
});

/** Aggregate stats — rank computed live against all users by score. */
router.get('/users/me/stats', userAuth, async (req, res) => {
  const u = await User.findById(req.user.sub).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  const [totalStudents, higher] = await Promise.all([
    User.countDocuments({ disabled: false }),
    User.countDocuments({ disabled: false, score: { $gt: u.score || 0 } }),
  ]);
  res.json(S.userStats(higher + 1, totalStudents, u.testsCompleted || 0, u.score || 0));
});

/** Leaderboard — top users by score. */
router.get('/leaderboard', async (_req, res) => {
  const users = await User.find({ disabled: false }).sort('-score').limit(50).lean();
  res.json(users.map(S.leaderEntry));
});

/** Upsert profile on onboarding completion (profile-setup finish()). */
router.put('/users/me', userAuth, async (req, res) => {
  const allowed = ['firstName', 'lastName', 'college', 'degree', 'stream', 'year', 'subjects', 'skills', 'hasResume', 'linkedinUrl', 'email'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  patch.lastActiveAt = new Date();
  const u = await User.findByIdAndUpdate(req.user.sub, { $set: patch }, { new: true }).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json(S.userProfile(u));
});

/* ---------- Portfolio CRUD: projects & certificates ---------- */
const PROJECT_FIELDS = ['title', 'meta', 'stars', 'icon', 'imageUrl', 'githubUrl'];
const CERT_FIELDS = ['title', 'issuer', 'year', 'icon', 'imageUrl'];

function pickFields(body, allowed) {
  const out = {};
  for (const k of allowed) if (k in (body || {})) out[k] = body[k];
  return out;
}

async function reloadProfile(id, res) {
  const u = await User.findById(id).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json(S.userProfile(u));
}

// Add
router.post('/users/me/projects', userAuth, async (req, res) => {
  await User.updateOne({ _id: req.user.sub }, { $push: { projects: pickFields(req.body, PROJECT_FIELDS) } });
  await reloadProfile(req.user.sub, res);
});
router.post('/users/me/certificates', userAuth, async (req, res) => {
  await User.updateOne({ _id: req.user.sub }, { $push: { certificates: pickFields(req.body, CERT_FIELDS) } });
  await reloadProfile(req.user.sub, res);
});
// Update by subdoc id
router.put('/users/me/projects/:pid', userAuth, async (req, res) => {
  const set = {};
  for (const k of PROJECT_FIELDS) if (k in (req.body || {})) set[`projects.$.${k}`] = req.body[k];
  await User.updateOne({ _id: req.user.sub, 'projects._id': req.params.pid }, { $set: set });
  await reloadProfile(req.user.sub, res);
});
router.put('/users/me/certificates/:cid', userAuth, async (req, res) => {
  const set = {};
  for (const k of CERT_FIELDS) if (k in (req.body || {})) set[`certificates.$.${k}`] = req.body[k];
  await User.updateOne({ _id: req.user.sub, 'certificates._id': req.params.cid }, { $set: set });
  await reloadProfile(req.user.sub, res);
});
// Delete by subdoc id
router.delete('/users/me/projects/:pid', userAuth, async (req, res) => {
  await User.updateOne({ _id: req.user.sub }, { $pull: { projects: { _id: req.params.pid } } });
  await reloadProfile(req.user.sub, res);
});
router.delete('/users/me/certificates/:cid', userAuth, async (req, res) => {
  await User.updateOne({ _id: req.user.sub }, { $pull: { certificates: { _id: req.params.cid } } });
  await reloadProfile(req.user.sub, res);
});

/* ---------- Saved CV ---------- */
router.put('/users/me/cv', userAuth, async (req, res) => {
  const { cvUrl, cvName } = req.body || {};
  if (!cvUrl) return res.status(400).json({ error: 'cvUrl required' });
  await User.updateOne(
    { _id: req.user.sub },
    { $set: { cvUrl, cvName: cvName || 'resume', cvUploadedAt: new Date(), hasResume: true } }
  );
  await reloadProfile(req.user.sub, res);
});

/* ---------- Job apply ---------- */
router.post('/jobs/:id/apply', userAuth, async (req, res) => {
  const job = await Job.findById(req.params.id).lean();
  if (!job) return res.status(404).json({ error: 'job not found' });
  let { cvUrl, cvName } = req.body || {};
  if (!cvUrl) {
    const u = await User.findById(req.user.sub).lean();
    cvUrl = u?.cvUrl;
    cvName = u?.cvName;
  }
  if (!cvUrl) return res.status(400).json({ error: 'no CV — upload a resume first' });
  try {
    const app = await Application.findOneAndUpdate(
      { job: req.params.id, user: req.user.sub },
      { $set: { cvUrl, cvName: cvName || 'resume' }, $setOnInsert: { status: 'applied' } },
      { upsert: true, new: true }
    );
    res.status(201).json({ ok: true, applicationId: String(app._id), status: app.status });
  } catch (e) {
    res.status(500).json({ error: 'apply failed' });
  }
});

/** Jobs the current user has applied to. */
router.get('/users/me/applications', userAuth, async (req, res) => {
  const apps = await Application.find({ user: req.user.sub }).sort('-createdAt').lean();
  res.json(apps.map((a) => ({ id: String(a._id), jobId: String(a.job), status: a.status, appliedAt: a.createdAt })));
});

/** Submit a mock test attempt. Records the result + bumps testsCompleted. */
router.post('/tests/:id/submit', userAuth, async (req, res) => {
  const test = await Test.findById(req.params.id).lean();
  if (!test) return res.status(404).json({ error: 'test not found' });
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const durationSec = Number(req.body?.durationSec) || 0;
  const total = answers.length || 0;
  const score = answers.filter((a) => a?.correct).length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  await TestAttempt.create({
    test: test._id, testTitle: test.title, user: req.user.sub,
    score, total, percent, durationSec, answers,
  });
  await User.updateOne({ _id: req.user.sub }, { $inc: { testsCompleted: 1 }, $set: { lastActiveAt: new Date() } });
  res.status(201).json({ ok: true, score, total, percent });
});

/** The current user's own attempts. */
router.get('/users/me/attempts', userAuth, async (req, res) => {
  const rows = await TestAttempt.find({ user: req.user.sub }).sort('-createdAt').limit(50).lean();
  res.json(rows.map((a) => ({ id: String(a._id), testTitle: a.testTitle, score: a.score, total: a.total, percent: a.percent, at: a.createdAt })));
});

/** Submit in-app feedback. */
router.post('/feedback', userAuth, async (req, res) => {
  const { rating, category, message, appVersion, platform } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message required' });
  await Feedback.create({
    user: req.user.sub,
    rating: Number(rating) || 0,
    category: ['General', 'Bug', 'Feature', 'Content'].includes(category) ? category : 'General',
    message: String(message).slice(0, 2000),
    appVersion: appVersion || '',
    platform: platform || '',
  });
  res.status(201).json({ ok: true });
});

export default router;
