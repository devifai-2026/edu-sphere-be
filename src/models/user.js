import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/** Onboarded student — persisted from the RN app on profile completion. */
const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true }, // identity
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    college: { type: String, default: '' },
    degree: { type: String, default: '' },
    stream: { type: String, default: '' },
    year: { type: String, default: '' },
    subjects: { type: [String], default: [] }, // chosen subject slugs
    skills: { type: [String], default: [] },
    hasResume: { type: Boolean, default: false },
    email: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    // Saved CV/resume (uploaded once, reused on Apply).
    cvUrl: { type: String, default: '' },
    cvName: { type: String, default: '' },
    cvUploadedAt: { type: Date, default: null },
    // Gamification / placement stats (admin-editable; some computed).
    streak: { type: Number, default: 0 },
    placementScore: { type: Number, default: 0 },
    testsCompleted: { type: Number, default: 0 },
    score: { type: Number, default: 0 }, // leaderboard score
    readiness: {
      type: [{ label: String, value: Number, icon: String, colors: [String] }],
      default: [],
    },
    projects: { type: [{ title: String, meta: String, stars: Number, icon: String, imageUrl: String, githubUrl: String }], default: [] },
    certificates: { type: [{ title: String, issuer: String, year: String, icon: String, imageUrl: String }], default: [] },
    disabled: { type: Boolean, default: false }, // admin soft-disable
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
export const User = model('User', userSchema);
