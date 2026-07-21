/**
 * Admin AI management, mounted under /admin (adminAuth).
 *   GET/PUT /admin/ai/settings — Gemini key + editable system prompts
 *   GET     /admin/ai/logs      — LLM call logs (user, input, output, timestamp)
 *   GET     /admin/ai/logs/:id  — a single log (full input/output)
 */
import { Router } from 'express';
import { AiSettings, getAiSettings, DEFAULT_PROMPTS, LlmLog } from '../models/aiSettings.js';

const router = Router();

/** Mask the API key so we never send the full secret to the browser. */
function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '••••';
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

router.get('/ai/settings', async (_req, res) => {
  const s = await getAiSettings();
  res.json({
    provider: s.provider,
    model: s.model,
    enabled: s.enabled,
    hasKey: Boolean(s.geminiApiKey),
    keyMasked: maskKey(s.geminiApiKey),
    keySource: s.geminiApiKey ? 'saved in DB' : 'none',
    prompts: s.prompts,
    defaults: DEFAULT_PROMPTS,
  });
});

router.put('/ai/settings', async (req, res) => {
  const s = await getAiSettings();
  const { geminiApiKey, model, enabled, prompts } = req.body || {};
  // Only overwrite the key when a non-empty new value is provided.
  if (typeof geminiApiKey === 'string' && geminiApiKey.trim()) s.geminiApiKey = geminiApiKey.trim();
  if (typeof model === 'string' && model) s.model = model;
  if (typeof enabled === 'boolean') s.enabled = enabled;
  if (prompts && typeof prompts === 'object') {
    if (typeof prompts.atsScore === 'string') s.prompts.atsScore = prompts.atsScore;
    if (typeof prompts.placementReadiness === 'string') s.prompts.placementReadiness = prompts.placementReadiness;
  }
  await s.save();
  res.json({
    provider: s.provider, model: s.model, enabled: s.enabled,
    hasKey: Boolean(s.geminiApiKey), keyMasked: maskKey(s.geminiApiKey),
    prompts: s.prompts, defaults: DEFAULT_PROMPTS,
  });
});

router.delete('/ai/settings/key', async (_req, res) => {
  const s = await getAiSettings();
  s.geminiApiKey = '';
  await s.save();
  res.json({ ok: true });
});

router.get('/ai/logs', async (req, res) => {
  const feature = req.query.feature;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const f = {};
  if (feature) f.feature = feature;
  const logs = await LlmLog.find(f)
    .sort('-createdAt')
    .limit(limit)
    .populate('user', 'firstName lastName phone')
    .lean();
  res.json(
    logs.map((l) => ({
      id: String(l._id),
      feature: l.feature,
      model: l.model,
      status: l.status,
      error: l.error,
      latencyMs: l.latencyMs,
      user: l.user ? { id: String(l.user._id), name: `${l.user.firstName} ${l.user.lastName}`.trim(), phone: l.user.phone } : null,
      inputPreview: (l.input || '').slice(0, 160),
      outputPreview: (l.output || '').slice(0, 160),
      createdAt: l.createdAt,
    }))
  );
});

router.get('/ai/logs/:id', async (req, res) => {
  const l = await LlmLog.findById(req.params.id).populate('user', 'firstName lastName phone').lean();
  if (!l) return res.status(404).json({ error: 'not found' });
  res.json({
    id: String(l._id),
    feature: l.feature,
    model: l.model,
    status: l.status,
    error: l.error,
    latencyMs: l.latencyMs,
    user: l.user ? { id: String(l.user._id), name: `${l.user.firstName} ${l.user.lastName}`.trim(), phone: l.user.phone } : null,
    input: l.input,
    output: l.output,
    parsed: l.parsed,
    createdAt: l.createdAt,
  });
});

export default router;
