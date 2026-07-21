/**
 * Shared publication fields applied to every CONTENT collection.
 * The public app API only ever returns { status: 'published', deletedAt: null }.
 * The admin API sees everything.
 */
export const publishableFields = {
  status: { type: String, enum: ['draft', 'published', 'hidden'], default: 'draft', index: true },
  publishedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
};

/** Query filter the app-facing endpoints use everywhere. */
export const PUBLIC_FILTER = { status: 'published', deletedAt: null };
