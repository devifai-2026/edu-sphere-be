import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/** A student's attempt/result for a mock test. */
const testAttemptSchema = new Schema(
  {
    test: { type: Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
    testTitle: { type: String, default: '' }, // denormalized for admin display
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    score: { type: Number, default: 0 }, // correct answers
    total: { type: Number, default: 0 }, // total questions
    percent: { type: Number, default: 0 }, // 0-100
    durationSec: { type: Number, default: 0 },
    answers: { type: [{ questionIndex: Number, selected: Number, correct: Boolean }], default: [] },
  },
  { timestamps: true }
);
testAttemptSchema.index({ user: 1, createdAt: -1 });
testAttemptSchema.index({ test: 1, createdAt: -1 });
export const TestAttempt = model('TestAttempt', testAttemptSchema);
