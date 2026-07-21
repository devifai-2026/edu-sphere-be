import mongoose from 'mongoose';
import { publishableFields } from './publishable.js';

const { Schema, model } = mongoose;

const mcqSchema = new Schema(
  { prompt: String, options: [String], correct: Number },
  { _id: true }
);
const descriptiveSchema = new Schema(
  { prompt: String, maxWords: Number },
  { _id: true }
);

/** Unified question — supports MCQ (with optional image prompt) and coding. */
const questionSchema = new Schema(
  {
    kind: { type: String, enum: ['mcq', 'coding'], default: 'mcq' },
    prompt: { type: String, default: '' },
    imageUrl: { type: String, default: '' }, // optional image prompt
    // MCQ
    options: { type: [String], default: [] },
    correct: { type: Number, default: 0 },
    // Coding
    starterCode: { type: String, default: '' },
    language: { type: String, default: '' },
    answer: { type: String, default: '' },
  },
  { _id: true }
);

const testSchema = new Schema(
  {
    title: { type: String, required: true },
    type: { type: String, enum: ['mcq', 'descriptive', 'coding', 'mixed'], required: true },
    streamId: { type: Schema.Types.ObjectId, ref: 'Stream', required: true, index: true },
    yearId: { type: Schema.Types.ObjectId, ref: 'Year', required: true, index: true },
    durationMin: { type: Number, default: 30 },
    icon: { type: String, default: 'flash' },
    colors: { type: [String], validate: (v) => v.length === 2 },
    questions: [questionSchema], // new unified questions
    mcq: [mcqSchema],            // legacy
    descriptive: [descriptiveSchema], // legacy
    ...publishableFields,
  },
  { timestamps: true }
);
export const Test = model('Test', testSchema);
