import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/** In-app user feedback, surfaced in the admin panel. */
const feedbackSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    category: { type: String, enum: ['General', 'Bug', 'Feature', 'Content'], default: 'General' },
    message: { type: String, required: true },
    appVersion: { type: String, default: '' },
    platform: { type: String, default: '' },
    status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new', index: true },
  },
  { timestamps: true }
);
export const Feedback = model('Feedback', feedbackSchema);
