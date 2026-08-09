import mongoose from 'mongoose';
import { publishableFields } from './publishable.js';

const { Schema, model } = mongoose;

/** Reference lists — colleges / streams / years / degrees. Matched by unique `name`. */
const refSchema = new Schema(
  { name: { type: String, required: true, unique: true }, order: { type: Number, default: 0 } },
  { timestamps: true }
);
export const College = model('College', refSchema.clone());
export const Stream = model('Stream', refSchema.clone());
export const Year = model('Year', refSchema.clone());
export const Degree = model('Degree', refSchema.clone());

/** Subject — the canonical academic subject (was the master `S` map). */
const subjectSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true }, // e.g. "dsa" — keeps app ids stable
    title: { type: String, required: true },
    icon: { type: String, required: true }, // Ionicons glyph name
    colors: { type: [String], validate: (v) => v.length === 2 }, // gradient pair
    ...publishableFields,
  },
  { timestamps: true }
);
export const Subject = model('Subject', subjectSchema);

/**
 * Eligibility mapping — replaces the `college|stream|year` composite-string keys.
 * collegeId null = wildcard (applies to all colleges, e.g. common 1st year).
 */
const eligibilitySchema = new Schema(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', default: null },
    streamId: { type: Schema.Types.ObjectId, ref: 'Stream', required: true },
    yearId: { type: Schema.Types.ObjectId, ref: 'Year', required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
eligibilitySchema.index({ collegeId: 1, streamId: 1, yearId: 1 });
export const SubjectEligibility = model('SubjectEligibility', eligibilitySchema);

/** Chapter → Topic → Video, normalized so a single video can be published/hidden. */
const chapterSchema = new Schema(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Chapter = model('Chapter', chapterSchema);

const topicSchema = new Schema(
  {
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true, index: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Topic = model('Topic', topicSchema);

const videoSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true }, // denormalized for findVideo
    title: { type: String, required: true },
    sourceType: { type: String, enum: ['youtube', 'file'], default: 'youtube' },
    // Required only for YouTube videos; file videos use videoUrl instead.
    youtubeId: { type: String, default: '', required: function () { return this.sourceType === 'youtube'; } },
    videoUrl: { type: String, default: '' }, // GCS object URL or external MP4 URL (sourceType 'file')
    duration: { type: String, default: '' },
    speedup: { type: Boolean, default: false },
    noteUrl: { type: String, default: '' },
    noteLabel: { type: String, default: '' },
    order: { type: Number, default: 0 },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Video = model('Video', videoSchema);
