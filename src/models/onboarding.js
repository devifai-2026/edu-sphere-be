import mongoose from 'mongoose';
import { publishableFields } from './publishable.js';

const { Schema, model } = mongoose;

/** Intro carousel slides shown before login — admin-managed (image + title + body). */
const onboardingSlideSchema = new Schema(
  {
    image: { type: String, default: '' }, // full-bleed background photo URL
    title: { type: String, required: true },
    body: { type: String, default: '' },
    order: { type: Number, default: 0 },
    ...publishableFields,
  },
  { timestamps: true }
);
export const OnboardingSlide = model('OnboardingSlide', onboardingSlideSchema);
