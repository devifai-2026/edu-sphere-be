import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../lib/db.js';
import mongoose from 'mongoose';
import { College, Stream, Year, Degree, Subject, SubjectEligibility, Chapter, Topic, Video } from '../models/catalog.js';
import { Test } from '../models/tests.js';
import { PYQ } from '../models/pyq.js';
import { Announcement, Banner, Job, Notification, Faq, ResumeConfig } from '../models/content.js';
import { Group } from '../models/community.js';
import { User } from '../models/user.js';
import { AdminUser } from '../models/adminUser.js';
import { ThemeConfig } from '../models/theme.js';
import { AiSettings, DEFAULT_PROMPTS } from '../models/aiSettings.js';
import * as data from './data.js';

const PUB = { status: 'published', publishedAt: new Date() };

async function run() {
  await connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edusphere');

  console.log('[seed] clearing content collections…');
  await Promise.all(
    [College, Stream, Year, Degree, Subject, SubjectEligibility, Chapter, Topic, Video, Test, PYQ, Announcement, Banner, Job, Notification, Faq, ResumeConfig, Group, ThemeConfig].map((M) => M.deleteMany({}))
  );

  // Reference lists
  const colleges = await College.insertMany(data.colleges.map((name, order) => ({ name, order })));
  const streams = await Stream.insertMany(data.streams.map((name, order) => ({ name, order })));
  const yearsD = await Year.insertMany(data.years.map((name, order) => ({ name, order })));
  await Degree.insertMany(data.degrees.map((name, order) => ({ name, order })));
  const collegeByName = Object.fromEntries(colleges.map((c) => [c.name, c._id]));
  const streamByName = Object.fromEntries(streams.map((s) => [s.name, s._id]));
  const yearByName = Object.fromEntries(yearsD.map((y) => [y.name, y._id]));
  console.log(`[seed] refs: ${colleges.length} colleges, ${streams.length} streams, ${yearsD.length} years`);

  // Subjects (slug is stable id the app already uses)
  const subjectDocs = await Subject.insertMany(
    Object.entries(data.subjects).map(([slug, s]) => ({ slug, title: s.title, icon: s.icon, colors: s.colors, ...PUB }))
  );
  const subjectBySlug = Object.fromEntries(subjectDocs.map((s) => [s.slug, s._id]));
  console.log(`[seed] ${subjectDocs.length} subjects`);

  // Eligibility (college '*' → null)
  await SubjectEligibility.insertMany(
    data.eligibility.flatMap((rule) =>
      rule.subjects.map((slug, order) => ({
        collegeId: rule.college === '*' ? null : collegeByName[rule.college],
        streamId: streamByName[rule.stream],
        yearId: yearByName[rule.year],
        subjectId: subjectBySlug[slug],
        order,
      }))
    )
  );
  console.log(`[seed] eligibility rules inserted`);

  // Chapters → topics → videos
  let chCount = 0, tpCount = 0, vdCount = 0;
  for (const [slug, chapters] of Object.entries(data.chapters)) {
    const subjectId = subjectBySlug[slug];
    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = await Chapter.create({ subjectId, title: chapters[ci].title, order: ci, ...PUB });
      chCount++;
      for (let ti = 0; ti < chapters[ci].topics.length; ti++) {
        const t = chapters[ci].topics[ti];
        const topic = await Topic.create({ chapterId: ch._id, title: t.title, order: ti, ...PUB });
        tpCount++;
        await Video.insertMany(
          t.videos.map((v, vi) => ({ topicId: topic._id, subjectId, title: v.title, youtubeId: v.youtubeId, duration: v.duration, speedup: !!v.speedup, noteUrl: v.noteUrl || '', noteLabel: v.noteLabel || '', order: vi, ...PUB }))
        );
        vdCount += t.videos.length;
      }
    }
  }
  console.log(`[seed] ${chCount} chapters, ${tpCount} topics, ${vdCount} videos`);

  // PYQs
  for (const [slug, list] of Object.entries(data.pyqs)) {
    await PYQ.insertMany(list.map((p) => ({ ...p, subjectId: subjectBySlug[slug], ...PUB })));
  }
  console.log(`[seed] pyqs inserted`);

  // Tests (resolve stream/year names → ids)
  await Test.insertMany(
    data.tests.map((t) => ({ ...t, streamId: streamByName[t.stream], yearId: yearByName[t.year], ...PUB }))
  );
  console.log(`[seed] ${data.tests.length} tests`);

  // Simple content
  await Announcement.insertMany(data.announcements.map((a) => ({ ...a, ...PUB })));
  await Banner.insertMany(data.banners.map((b) => ({ ...b, ...PUB })));
  await Job.insertMany(data.jobs.map((j) => ({ ...j, ...PUB })));
  await Notification.insertMany(data.notifications.map((n) => ({ ...n, ...PUB })));
  await Faq.insertMany(data.faqs.map((f) => ({ ...f, ...PUB })));
  await ResumeConfig.create(data.resumeConfig);
  await Group.insertMany(data.groups.map((g) => ({ ...g, ...PUB })));
  console.log('[seed] announcements/banners/jobs/notifications/faqs/resume/groups inserted');

  // Theme
  await ThemeConfig.create(data.theme);
  console.log('[seed] theme inserted');

  // Seed users (upsert by phone so real onboarded users aren't clobbered)
  for (const u of data.users) {
    await User.findOneAndUpdate({ phone: u.phone }, { $set: u }, { upsert: true });
  }
  console.log(`[seed] ${data.users.length} users upserted`);

  // Enroll all seeded users into every seeded group so member counts are REAL
  // (computed from memberIds), not fabricated numbers.
  const allUserIds = (await User.find().select('_id').lean()).map((u) => u._id);
  await Group.updateMany({}, { $set: { memberIds: allUserIds } });
  console.log(`[seed] enrolled ${allUserIds.length} users into ${data.groups.length} groups (real member counts)`);

  // Admin user
  const email = (process.env.ADMIN_EMAIL || 'admin@edusphere.app').toLowerCase();
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  await AdminUser.findOneAndUpdate({ email }, { email, passwordHash, role: 'admin' }, { upsert: true });
  console.log(`[seed] admin user ready: ${email}`);

  // AI settings — seed the latest default prompts into the DB. The Gemini key
  // is read from the SEED_GEMINI_API_KEY env var (never hardcoded); leave unset
  // to configure it later from the admin AI Settings page.
  const seedSet = {
    model: 'gemini-flash-latest',
    enabled: true,
    'prompts.atsScore': DEFAULT_PROMPTS.atsScore,
    'prompts.placementReadiness': DEFAULT_PROMPTS.placementReadiness,
  };
  if (process.env.SEED_GEMINI_API_KEY) seedSet.geminiApiKey = process.env.SEED_GEMINI_API_KEY;
  await AiSettings.findOneAndUpdate(
    { key: 'singleton' },
    {
      $set: seedSet,
      $setOnInsert: { key: 'singleton', provider: 'gemini' },
    },
    { upsert: true }
  );
  console.log('[seed] AI settings (Gemini key + prompts) seeded');

  await mongoose.disconnect();
  console.log('[seed] done ✅');
}

run().catch((e) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
