import mongoose from 'mongoose';
import { publishableFields } from './publishable.js';

const { Schema, model } = mongoose;

/**
 * Subject-level study notes (a PDF, like a PYQ). First-class so the app can list
 * them under a subject's "Notes" tab, distinct from a lecture's per-video noteUrl.
 *
 * subjectSlug is denormalized (written atomically by the admin subject picker)
 * so the app can resolve `/api/subjects/:slug/notes` in one indexed query — the
 * same stable-slug addressing used by chapters and PYQs.
 */
const noteSchema = new Schema(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    subjectSlug: { type: String, required: true, index: true },
    subjectLabel: { type: String, default: '' }, // display convenience for the admin table
    title: { type: String, required: true },
    pdfUrl: { type: String, default: '' },
    pages: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    ...publishableFields,
  },
  { timestamps: true }
);
export const Note = model('Note', noteSchema);
