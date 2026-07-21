import mongoose from 'mongoose';
import { publishableFields } from './publishable.js';

const { Schema, model } = mongoose;

const announcementSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, default: '' },
    tag: { type: String, enum: ['Test', 'Job', 'General', 'Event'], default: 'General' },
    icon: { type: String, default: 'megaphone' },
    publishAt: { type: Date, default: null },
    expireAt: { type: Date, default: null },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Announcement = model('Announcement', announcementSchema);

const bannerSchema = new Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    cta: { type: String, default: '' },
    colors: { type: [String], validate: (v) => v.length === 2 },
    icon: { type: String, default: 'rocket' },
    imageUrl: { type: String, default: '' }, // full-bleed banner image (overrides gradient when set)
    order: { type: Number, default: 0 },
    linkUrl: { type: String, default: '' },
    // Deep-link target inside the app (admin picks; app routes on tap).
    linkType: { type: String, enum: ['none', 'job', 'announcement', 'subject', 'test', 'screen', 'url'], default: 'none' },
    linkId: { type: String, default: '' },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Banner = model('Banner', bannerSchema);

const jobSchema = new Schema(
  {
    role: { type: String, required: true },
    company: { type: String, default: '' },
    companyLogo: { type: String, default: '' }, // uploaded image URL
    type: { type: String, enum: ['Internship', 'Full-time'], default: 'Internship' },
    // Salary — naukri-style: explicit range OR masked ("not disclosed") OR unspecified.
    salaryMode: { type: String, enum: ['range', 'masked', 'unspecified'], default: 'range' },
    salaryMin: { type: Number, default: 0 },
    salaryMax: { type: Number, default: 0 },
    salaryUnit: { type: String, enum: ['per month', 'per year', 'LPA', 'stipend/mo'], default: 'LPA' },
    stipend: { type: String, default: '' }, // legacy free-text fallback
    location: { type: String, default: '' },
    workMode: { type: String, enum: ['On-site', 'Remote', 'Hybrid'], default: 'On-site' },
    experience: { type: String, default: '' }, // e.g. "0–2 yrs"
    openings: { type: Number, default: 1 },
    applyBy: { type: Date, default: null },
    // Rich content (HTML from the admin TipTap editor).
    descriptionHtml: { type: String, default: '' }, // full JD
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    perks: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    applyUrl: { type: String, default: '' }, // external apply link (optional)
    logoColor: { type: [String], validate: (v) => v.length === 2 },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Job = model('Job', jobSchema);

/** A student's application to a job (created from the mobile Apply Now flow). */
const applicationSchema = new Schema(
  {
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cvUrl: { type: String, default: '' },
    cvName: { type: String, default: '' },
    status: { type: String, enum: ['applied', 'viewed', 'shortlisted', 'rejected'], default: 'applied' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);
applicationSchema.index({ job: 1, user: 1 }, { unique: true }); // one application per user per job
export const Application = model('Application', applicationSchema);

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // null = broadcast
    category: { type: String, enum: ['Tests', 'Jobs', 'Internships', 'Community', 'Announcements'], default: 'Announcements' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    icon: { type: String, default: 'notifications' },
    unread: { type: Boolean, default: true },
    // Deep-link target inside the app.
    linkType: { type: String, enum: ['none', 'job', 'announcement', 'subject', 'test', 'screen', 'url'], default: 'none' },
    linkId: { type: String, default: '' },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Notification = model('Notification', notificationSchema);

const faqSchema = new Schema(
  { q: { type: String, required: true }, a: { type: String, default: '' }, order: { type: Number, default: 0 }, ...publishableFields },
  { timestamps: true }
);
export const Faq = model('Faq', faqSchema);

/** Single-doc config for the resume analyzer copy (was inline in resume-analyzer.tsx). */
const resumeConfigSchema = new Schema(
  {
    key: { type: String, default: 'default', unique: true },
    suggestions: [{ icon: String, text: String, tone: String }],
    missing: { type: [String], default: [] },
  },
  { timestamps: true }
);
export const ResumeConfig = model('ResumeConfig', resumeConfigSchema);
