/**
 * Serializers — reshape Mongoose docs into the exact shapes the RN app already
 * expects (see src/data/*.ts), so screens don't have to change.
 */

export const subject = (s) => ({ id: s.slug, title: s.title, icon: s.icon, colors: s.colors });

export const video = (v) => ({
  id: String(v._id),
  title: v.title,
  youtubeId: v.youtubeId,
  duration: v.duration,
  ...(v.speedup ? { speedup: true } : {}),
  ...(v.noteUrl ? { noteUrl: v.noteUrl } : {}),
  ...(v.noteLabel ? { noteLabel: v.noteLabel } : {}),
});

export const topic = (t, videos) => ({ id: String(t._id), title: t.title, videos: videos.map(video) });

export const chapter = (ch, subjectSlug, topics) => ({
  id: String(ch._id),
  subjectId: subjectSlug,
  title: ch.title,
  topics,
});

export const test = (t, streamName, yearName) => ({
  id: String(t._id),
  title: t.title,
  type: t.type,
  stream: streamName,
  year: yearName,
  durationMin: t.durationMin,
  attempts: t.attempts ?? 0,
  icon: t.icon,
  colors: t.colors,
  ...(t.mcq?.length ? { mcq: t.mcq.map((q) => ({ id: String(q._id), prompt: q.prompt, options: q.options, correct: q.correct })) } : {}),
  ...(t.descriptive?.length ? { descriptive: t.descriptive.map((q) => ({ id: String(q._id), prompt: q.prompt, maxWords: q.maxWords })) } : {}),
});

export const pyq = (p) => ({
  id: String(p._id),
  subject: p.subjectLabel,
  examYear: p.examYear,
  semester: p.semester,
  pages: p.pages,
  pdfUrl: p.pdfUrl,
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

export const notification = (n) => ({
  id: String(n._id),
  category: n.category,
  title: n.title,
  body: n.body,
  time: n.createdAt ? timeAgo(n.createdAt) : '',
  icon: n.icon,
  unread: n.unread,
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
  hasResume: u.hasResume,
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
