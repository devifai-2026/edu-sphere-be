/**
 * Serializers — reshape Mongoose docs into the exact shapes the RN app already
 * expects (see src/data/*.ts), so screens don't have to change.
 */
import { signReadUrl, keyFromPublicUrl, gcsConfigured } from './gcs.js';

export const subject = (s) => ({ id: s.slug, title: s.title, icon: s.icon, colors: s.colors });

/**
 * Uploaded ("file") lecture videos are re-signed to a short-lived GET URL on
 * every read instead of handing out the permanent public objectUrl — so the
 * link a student's app receives goes stale rather than being forever
 * re-shareable. YouTube-sourced videos are untouched (YouTube already hosts
 * and protects that content). Falls back to the stored URL unchanged for
 * externally-pasted video URLs (not one of our own GCS objects) or if GCS
 * isn't configured / signing fails, so playback never hard-breaks.
 */
async function resolveVideoUrl(v) {
  if (v.sourceType !== 'file' || !v.videoUrl || !gcsConfigured()) return v.videoUrl;
  const key = keyFromPublicUrl(v.videoUrl);
  if (!key) return v.videoUrl; // an externally-pasted URL, not one of ours
  try {
    return await signReadUrl(key);
  } catch (e) {
    console.error('[serialize] signReadUrl failed, falling back to stored url:', e?.message || e);
    return v.videoUrl;
  }
}

export const video = async (v) => ({
  id: String(v._id),
  title: v.title,
  sourceType: v.sourceType || 'youtube', // legacy rows default to youtube
  youtubeId: v.youtubeId || '',
  duration: v.duration,
  ...(v.videoUrl ? { videoUrl: await resolveVideoUrl(v) } : {}),
  ...(v.speedup ? { speedup: true } : {}),
  ...(v.noteUrl ? { noteUrl: v.noteUrl } : {}),
  ...(v.noteLabel ? { noteLabel: v.noteLabel } : {}),
});

export const topic = async (t, videos) => ({ id: String(t._id), title: t.title, videos: await Promise.all(videos.map(video)) });

export const chapter = (ch, subjectSlug, topics) => ({
  id: String(ch._id),
  subjectId: subjectSlug,
  title: ch.title,
  topics,
});

/**
 * The admin panel only has a UI for the unified `questions[]` field (see
 * learn-admin's QuestionsEditor) — it never writes the legacy `mcq`/`descriptive`
 * arrays. Resolve the effective MCQ answer key from `questions[]` first, falling
 * back to the legacy field so any test seeded directly against the old shape
 * still works. Exported so the submit route can grade against the same source
 * of truth this serializer advertises.
 */
export function resolveMcq(t) {
  const qs = Array.isArray(t.questions) ? t.questions : [];
  const unified = qs.filter((q) => (q.kind || 'mcq') === 'mcq');
  return unified.length ? unified : (Array.isArray(t.mcq) ? t.mcq : []);
}

function resolveDescriptive(t) {
  const qs = Array.isArray(t.questions) ? t.questions : [];
  const unified = qs.filter((q) => q.kind === 'descriptive');
  return unified.length ? unified : (Array.isArray(t.descriptive) ? t.descriptive : []);
}

export const test = (t, streamName, yearName) => {
  const mcqSource = resolveMcq(t);
  const codingSource = (Array.isArray(t.questions) ? t.questions : []).filter((q) => q.kind === 'coding');
  const descriptiveSource = resolveDescriptive(t);
  return {
    id: String(t._id),
    title: t.title,
    type: t.type,
    stream: streamName,
    year: yearName,
    durationMin: t.durationMin,
    attempts: t.attempts ?? 0,
    icon: t.icon,
    colors: t.colors,
    // NOTE: never include `correct`/`answer` here — this payload is served
    // pre-attempt (GET /tests, GET /tests/:id are unauthenticated) and
    // grading happens server-side in POST /tests/:id/submit.
    ...(mcqSource.length ? { mcq: mcqSource.map((q) => ({ id: String(q._id), prompt: q.prompt, options: q.options, ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}) })) } : {}),
    ...(descriptiveSource.length ? { descriptive: descriptiveSource.map((q) => ({ id: String(q._id), prompt: q.prompt, maxWords: q.maxWords })) } : {}),
    ...(codingSource.length ? { coding: codingSource.map((q) => ({ id: String(q._id), prompt: q.prompt, ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}), starterCode: q.starterCode, language: q.language })) } : {}),
  };
};

export const pyq = (p) => ({
  id: String(p._id),
  subject: p.subjectLabel,
  examYear: p.examYear,
  semester: p.semester,
  pages: p.pages,
  pdfUrl: p.pdfUrl,
});

export const note = (n) => ({
  id: String(n._id),
  title: n.title,
  pdfUrl: n.pdfUrl,
  pages: n.pages,
});

export const announcement = (a) => ({
  id: String(a._id),
  title: a.title,
  body: a.body,
  date: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : '',
  tag: a.tag,
  icon: a.icon,
});

export const banner = (b) => ({ id: String(b._id), title: b.title, subtitle: b.subtitle, cta: b.cta, colors: b.colors, icon: b.icon, imageUrl: b.imageUrl || '', linkType: b.linkType || 'none', linkId: b.linkId || '', linkUrl: b.linkUrl || '' });

export const onboardingSlide = (s) => ({ id: String(s._id), image: s.image || '', title: s.title, body: s.body || '' });

/** Human-readable salary label following naukri-style masking rules. */
export function salaryLabel(j) {
  if (j.salaryMode === 'masked') return 'Not disclosed';
  if (j.salaryMode === 'unspecified') return 'Not specified';
  const unit = j.salaryUnit || 'LPA';
  const fmt = (n) => (unit === 'LPA' ? `₹${n}` : `₹${Number(n).toLocaleString('en-IN')}`);
  if (j.salaryMin && j.salaryMax) return `${fmt(j.salaryMin)}–${fmt(j.salaryMax)} ${unit}`;
  if (j.salaryMin) return `${fmt(j.salaryMin)}+ ${unit}`;
  if (j.stipend) return j.stipend; // legacy fallback
  return 'Not specified';
}

export const job = (j) => ({
  id: String(j._id),
  role: j.role,
  company: j.company,
  companyLogo: j.companyLogo || '',
  type: j.type,
  salaryLabel: salaryLabel(j),
  salaryMode: j.salaryMode || 'range',
  stipend: j.stipend,
  location: j.location,
  workMode: j.workMode || 'On-site',
  experience: j.experience || '',
  openings: j.openings || 1,
  applyBy: j.applyBy || null,
  descriptionHtml: j.descriptionHtml || '',
  responsibilities: j.responsibilities || [],
  requirements: j.requirements || [],
  perks: j.perks || [],
  skills: j.skills || [],
  applyUrl: j.applyUrl || '',
  postedAgo: j.createdAt ? timeAgo(j.createdAt) : '',
  logoColor: j.logoColor,
});

// userId is required so a broadcast notification's read state can be computed
// per-viewer instead of trusting the shared `unread` flag directly (see the
// readBy comment on the schema).
export const notification = (n, userId) => ({
  id: String(n._id),
  category: n.category,
  title: n.title,
  body: n.body,
  time: n.createdAt ? timeAgo(n.createdAt) : '',
  icon: n.icon,
  unread: n.unread && !(n.readBy || []).some((id) => String(id) === String(userId)),
  linkType: n.linkType || 'none',
  linkId: n.linkId || '',
});

export const faq = (f) => ({ id: String(f._id), q: f.q, a: f.a });

export const group = (g) => ({
  id: String(g._id),
  name: g.name,
  // Always the real member count (length of actual memberIds), never a stored/seeded number.
  members: Array.isArray(g.memberIds) ? g.memberIds.length : 0,
  unread: 0,
  lastMsg: g.lastMsg,
  icon: g.icon,
  online: true,
  description: g.description || '',
  ...(g.official ? { official: true } : {}),
  ...(g.recommended ? { recommended: true } : {}),
});

export const userProfile = (u) => ({
  id: String(u._id),
  phone: u.phone,
  firstName: u.firstName,
  lastName: u.lastName,
  college: u.college,
  degree: u.degree,
  stream: u.stream,
  year: u.year,
  subjects: u.subjects,
  skills: u.skills,
  email: u.email || '',
  linkedinUrl: u.linkedinUrl || '',
  cvUrl: u.cvUrl || '',
  cvName: u.cvName || '',
  hasResume: Boolean(u.cvUrl) || u.hasResume,
  streak: u.streak || 0,
  placementScore: u.placementScore || 0,
  readiness: u.readiness || [],
  projects: (u.projects || []).map((p) => ({ id: String(p._id), title: p.title, meta: p.meta, stars: p.stars, icon: p.icon, imageUrl: p.imageUrl || '', githubUrl: p.githubUrl || '' })),
  certificates: (u.certificates || []).map((c) => ({ id: String(c._id), title: c.title, issuer: c.issuer, year: c.year, icon: c.icon, imageUrl: c.imageUrl || '' })),
  savedJobIds: (u.savedJobIds || []).map(String),
});

/** Aggregate stats (rank computed against the whole user pool). */
export const userStats = (rank, totalStudents, testsCompleted, score = 0) => ({ rank, totalStudents, testsCompleted, score });

export const leaderEntry = (u, i) => ({
  id: String(u._id),
  name: `${u.firstName} ${u.lastName}`.trim() || 'Student',
  college: u.college || '',
  score: u.score || 0,
  delta: 0,
});

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
