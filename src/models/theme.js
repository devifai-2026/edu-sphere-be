import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * Single active theme doc the app fetches at launch. Mirrors src/theme/colors.ts:
 * 24 color keys + 6 gradient keys. Stored loosely (Mixed) so the admin can edit any
 * subset; the app deep-merges over its built-in dark palette.
 */
const themeSchema = new Schema(
  {
    key: { type: String, default: 'active', unique: true },
    label: { type: String, default: 'Default' },
    colors: { type: Schema.Types.Mixed, default: {} },   // ThemeColors overrides
    gradients: { type: Schema.Types.Mixed, default: {} }, // GradientSet overrides
    tokens: { type: Schema.Types.Mixed, default: {} },    // optional spacing/radii overrides
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const ThemeConfig = model('ThemeConfig', themeSchema);
