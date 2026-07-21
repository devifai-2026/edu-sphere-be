import { Router } from 'express';
import { crudRouter } from './crudFactory.js';
import { College, Stream, Year, Degree, Subject, SubjectEligibility, Chapter, Topic, Video } from '../models/catalog.js';
import { Test } from '../models/tests.js';
import { PYQ } from '../models/pyq.js';
import { Announcement, Banner, Job, Notification, Faq, ResumeConfig, Application } from '../models/content.js';
import { Feedback } from '../models/feedback.js';
import { Group, ChatMessage, Invite, GroupMembershipLog } from '../models/community.js';
import { User } from '../models/user.js';
import { ThemeConfig } from '../models/theme.js';
import { AnalyticsEvent, AnalyticsSession } from '../models/analytics.js';
import { LlmLog } from '../models/aiSettings.js';
import { TestAttempt } from '../models/testAttempt.js';

const router = Router();

/* ---- reference lists (simple CRUD, not publishable) ---- */
function refRouter(Model) {
  const r = Router();
  r.get('/', async (_req, res) => res.json(await Model.find().sort('order name').lean()));
  r.post('/', async (req, res) => res.status(201).json(await Model.create(req.body || {})));
  r.put('/:id', async (req, res) => res.json(await Model.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })));
  r.delete('/:id', async (req, res) => { await Model.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
  return r;
}
router.use('/colleges', refRouter(College));
router.use('/streams', refRouter(Stream));
router.use('/years', refRouter(Year));
router.use('/degrees', refRouter(Degree));

/* ---- publishable content ---- */
router.use('/subjects', crudRouter(Subject, { defaultSort: 'title' }));
router.use('/chapters', crudRouter(Chapter, { defaultSort: 'order' }));
router.use('/topics', crudRouter(Topic, { defaultSort: 'order' }));
router.use('/videos', crudRouter(Video, { defaultSort: 'order' }));
router.use('/tests', crudRouter(Test));
router.use('/pyqs', crudRouter(PYQ, { defaultSort: '-examYear' }));
router.use('/announcements', crudRouter(Announcement));
router.use('/banners', crudRouter(Banner, { defaultSort: 'order' }));
router.use('/jobs', crudRouter(Job));
router.use('/notifications', crudRouter(Notification));
router.use('/faqs', crudRouter(Faq, { defaultSort: 'order' }));
router.use('/groups', crudRouter(Group, { defaultSort: '-official' }));

/* ---- eligibility mapping (non-publishable join table) ---- */
const elig = Router();
elig.get('/', async (req, res) => {
  const f = {};
  if (req.query.streamId) f.streamId = req.query.streamId;
  if (req.query.yearId) f.yearId = req.query.yearId;
  res.json(await SubjectEligibility.find(f).sort('order').lean());
});
elig.post('/', async (req, res) => res.status(201).json(await SubjectEligibility.create(req.body || {})));
elig.put('/:id', async (req, res) => res.json(await SubjectEligibility.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })));
elig.delete('/:id', async (req, res) => { await SubjectEligibility.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
router.use('/eligibility', elig);

/* ---- community moderation ---- */
const community = Router();
// Monitor chat for a group (or all), newest first, incl. deleted (flagged).
community.get('/chat', async (req, res) => {
  const f = req.query.groupId ? { groupId: req.query.groupId } : {};
  const msgs = await ChatMessage.find(f).sort('-createdAt').limit(300).lean();
  res.json(msgs.map((m) => ({
    id: String(m._id),
    groupId: String(m.groupId),
    text: m.text,
    kind: m.kind || 'text',
    imageUrl: m.imageUrl || '',
    fromAdmin: !!m.fromAdmin,
    senderName: m.fromAdmin ? 'Admin' : (m.senderName || '—'),
    deleted: !!m.deleted,
    time: m.createdAt,
  })));
});
// Delete (soft) any message.
community.delete('/chat/:id', async (req, res) => {
  await ChatMessage.findByIdAndUpdate(req.params.id, { $set: { deleted: true } });
  res.json({ ok: true });
});
// Admin posts to a group — may include an image (students cannot).
community.post('/chat', async (req, res) => {
  const { groupId, text, imageUrl } = req.body || {};
  if (!groupId) return res.status(400).json({ error: 'groupId required' });
  if (!text && !imageUrl) return res.status(400).json({ error: 'text or imageUrl required' });
  const msg = await ChatMessage.create({
    groupId, fromAdmin: true, senderName: 'Admin',
    kind: imageUrl ? 'image' : 'text', text: text || '', imageUrl: imageUrl || '',
  });
  await Group.updateOne({ _id: groupId }, { $set: { lastMsg: text ? text.slice(0, 80) : '📷 Photo' } });
  res.status(201).json({ id: String(msg._id), ok: true });
});
// List a group's members.
community.get('/groups/:id/members', async (req, res) => {
  const g = await Group.findById(req.params.id).lean();
  if (!g) return res.status(404).json({ error: 'not found' });
  const members = await User.find({ _id: { $in: g.memberIds || [] } }).select('firstName lastName phone college').lean();
  res.json(members.map((m) => ({ id: String(m._id), name: `${m.firstName} ${m.lastName}`.trim() || m.phone, phone: m.phone, college: m.college })));
});
// Remove a member from a group.
community.delete('/groups/:id/members/:userId', async (req, res) => {
  const g = await Group.findByIdAndUpdate(req.params.id, { $pull: { memberIds: req.params.userId } }, { new: true });
  if (!g) return res.status(404).json({ error: 'not found' });
  await Group.updateOne({ _id: g._id }, { $set: { members: (g.memberIds || []).length } });
  const u = await User.findById(req.params.userId).select('firstName lastName').lean();
  await GroupMembershipLog.create({ group: g._id, groupName: g.name, user: req.params.userId, userName: `${u?.firstName || ''} ${u?.lastName || ''}`.trim(), action: 'leave', by: 'admin' });
  res.json({ ok: true });
});
// Membership audit log (join/leave history).
community.get('/membership-log', async (req, res) => {
  const f = {};
  if (req.query.groupId) f.group = req.query.groupId;
  const logs = await GroupMembershipLog.find(f).sort('-createdAt').limit(Number(req.query.limit) || 200).lean();
  res.json(logs.map((l) => ({ id: String(l._id), group: l.groupName, user: l.userName, action: l.action, by: l.by, at: l.createdAt })));
});
community.get('/invites', async (_req, res) => res.json(await Invite.find().sort('-createdAt').lean()));
router.use('/community', community);

/* ---- users (view/search/filter/disable) ---- */
const users = Router();
users.get('/', async (req, res) => {
  const { search, college, stream, year, limit = 100, skip = 0 } = req.query;
  const f = {};
  if (college) f.college = college;
  if (stream) f.stream = stream;
  if (year) f.year = year;
  if (search) {
    const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    f.$or = [{ firstName: re }, { lastName: re }, { phone: re }];
  }
  const [items, total] = await Promise.all([
    User.find(f).sort('-createdAt').limit(Number(limit)).skip(Number(skip)).lean(),
    User.countDocuments(f),
  ]);
  res.json({ items, total });
});
users.get('/:id', async (req, res) => {
  const u = await User.findById(req.params.id).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json(u);
});
users.patch('/:id/disable', async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { $set: { disabled: !!req.body?.disabled } }, { new: true });
  res.json(u);
});
// Block / unblock — blocked users are force-logged-out on their next API call.
users.patch('/:id/block', async (req, res) => {
  const disabled = req.body?.blocked !== false; // default true
  const u = await User.findByIdAndUpdate(req.params.id, { $set: { disabled } }, { new: true }).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, blocked: u.disabled });
});
// Hard delete — remove the user and cascade-delete all their data.
users.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const u = await User.findById(id).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  const oid = u._id;
  await Promise.all([
    Application.deleteMany({ user: oid }),
    Feedback.deleteMany({ user: oid }),
    AnalyticsEvent.deleteMany({ user: oid }),
    AnalyticsSession.deleteMany({ user: oid }),
    Notification.deleteMany({ userId: oid }),
    ChatMessage.deleteMany({ senderId: oid }),
    Invite.deleteMany({ fromUserId: oid }),
    LlmLog.deleteMany({ user: oid }),
  ]);
  await User.deleteOne({ _id: oid });
  res.json({ ok: true, deleted: true });
});
router.use('/users', users);

/* ---- job applications (admin view) ---- */
const applications = Router();
applications.get('/', async (req, res) => {
  const f = {};
  if (req.query.jobId) f.job = req.query.jobId;
  if (req.query.status) f.status = req.query.status;
  const apps = await Application.find(f)
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 200)
    .populate('job', 'role company')
    .populate('user', 'firstName lastName phone college stream year')
    .lean();
  res.json(
    apps.map((a) => ({
      id: String(a._id),
      status: a.status,
      appliedAt: a.createdAt,
      cvUrl: a.cvUrl,
      cvName: a.cvName,
      job: a.job ? { id: String(a.job._id), role: a.job.role, company: a.job.company } : null,
      user: a.user
        ? { id: String(a.user._id), name: `${a.user.firstName} ${a.user.lastName}`.trim(), phone: a.user.phone, college: a.user.college, stream: a.user.stream, year: a.user.year }
        : null,
    }))
  );
});
applications.patch('/:id/status', async (req, res) => {
  const a = await Application.findByIdAndUpdate(req.params.id, { $set: { status: req.body?.status } }, { new: true });
  res.json({ ok: true, status: a?.status });
});
router.use('/applications', applications);

/* ---- feedback (admin view) ---- */
const feedback = Router();
feedback.get('/', async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  const items = await Feedback.find(f)
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 200)
    .populate('user', 'firstName lastName phone')
    .lean();
  res.json(
    items.map((x) => ({
      id: String(x._id),
      rating: x.rating,
      category: x.category,
      message: x.message,
      status: x.status,
      platform: x.platform,
      appVersion: x.appVersion,
      createdAt: x.createdAt,
      user: x.user ? { id: String(x.user._id), name: `${x.user.firstName} ${x.user.lastName}`.trim(), phone: x.user.phone } : null,
    }))
  );
});
feedback.patch('/:id/status', async (req, res) => {
  const x = await Feedback.findByIdAndUpdate(req.params.id, { $set: { status: req.body?.status } }, { new: true });
  res.json({ ok: true, status: x?.status });
});
router.use('/feedback', feedback);

/* ---- test attempts / results (admin view) ---- */
const attempts = Router();
attempts.get('/', async (req, res) => {
  const f = {};
  if (req.query.testId) f.test = req.query.testId;
  if (req.query.userId) f.user = req.query.userId;
  const rows = await TestAttempt.find(f)
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 200)
    .populate('user', 'firstName lastName phone college')
    .lean();
  res.json(rows.map((a) => ({
    id: String(a._id),
    testTitle: a.testTitle,
    score: a.score, total: a.total, percent: a.percent, durationSec: a.durationSec,
    at: a.createdAt,
    user: a.user ? { id: String(a.user._id), name: `${a.user.firstName} ${a.user.lastName}`.trim() || a.user.phone, phone: a.user.phone, college: a.user.college } : null,
  })));
});
router.use('/attempts', attempts);

/* ---- resume config (single doc) ---- */
router.get('/resume-config', async (_req, res) => res.json((await ResumeConfig.findOne({ key: 'default' }).lean()) || {}));
router.put('/resume-config', async (req, res) => {
  const rc = await ResumeConfig.findOneAndUpdate({ key: 'default' }, { $set: { ...req.body, key: 'default' } }, { upsert: true, new: true });
  res.json(rc);
});

/* ---- theme (single active doc) ---- */
router.get('/theme', async (_req, res) => res.json((await ThemeConfig.findOne({ active: true }).lean()) || {}));
router.put('/theme', async (req, res) => {
  const patch = {};
  for (const k of ['label', 'colors', 'gradients', 'tokens']) if (k in (req.body || {})) patch[k] = req.body[k];
  const t = await ThemeConfig.findOneAndUpdate({ active: true }, { $set: { ...patch, active: true, key: 'active' } }, { upsert: true, new: true });
  res.json(t);
});

export default router;
