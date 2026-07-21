import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * Raw behavioral events emitted by the mobile app. One document per event.
 * Kept intentionally flat + indexed for time-range and per-user aggregation.
 */
const eventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, index: true }, // client-generated per app-open
    type: {
      type: String,
      enum: ['session_start', 'session_end', 'screen_view', 'search'],
      required: true,
      index: true,
    },
    // screen_view
    screen: { type: String, default: '' },
    // search
    query: { type: String, default: '' },
    resultCount: { type: Number, default: 0 },
    // session_end
    durationMs: { type: Number, default: 0 },
    // misc client context
    platform: { type: String, default: '' }, // ios | android | web
    appVersion: { type: String, default: '' },
    ts: { type: Date, default: Date.now, index: true }, // client event time
  },
  { timestamps: true }
);
// Common query: events for a user over time; events of a type over time.
eventSchema.index({ user: 1, ts: -1 });
eventSchema.index({ type: 1, ts: -1 });
export const AnalyticsEvent = model('AnalyticsEvent', eventSchema);

/**
 * Rolled-up session record — one per app-open. Created on session_start,
 * closed (endedAt + durationMs) on session_end. Enables fast total-time,
 * session-count and DAU/retention queries without scanning raw events.
 */
const sessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    screenViews: { type: Number, default: 0 },
    searches: { type: Number, default: 0 },
    platform: { type: String, default: '' },
    appVersion: { type: String, default: '' },
  },
  { timestamps: true }
);
sessionSchema.index({ user: 1, startedAt: -1 });
export const AnalyticsSession = model('AnalyticsSession', sessionSchema);
