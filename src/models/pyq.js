import mongoose from 'mongoose';
import { publishableFields } from './publishable.js';

const { Schema, model } = mongoose;

const pyqSchema = new Schema(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    subjectLabel: { type: String, default: '' }, // display label (was the free-text `subject`)
    examYear: { type: Number, required: true },
    semester: { type: String, default: 'End Sem' },
    pages: { type: Number, default: 0 },
    pdfUrl: { type: String, default: '' },
    ...publishableFields,
  },
  { timestamps: true }
);
export const PYQ = model('PYQ', pyqSchema);
