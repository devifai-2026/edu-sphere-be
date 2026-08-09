/**
 * Admin AI management, mounted under /admin (adminAuth).
 *   GET/PUT /admin/ai/settings — Gemini key + editable system prompts
 *   GET     /admin/ai/logs      — LLM call logs (user, input, output, timestamp)
 *   GET     /admin/ai/logs/:id  — a single log (full input/output)
 */
import { Router } from 'express';
import { AiSettings, getAiSettings, DEFAULT_PROMPTS, LlmLog } from '../models/aiSettings.js';
import { googleConfigured, getProjectId } from '../lib/googleAuth.js';

const router = Router();

/** Where the Vertex service-account credentials come from (never the value). */
function credentialSource() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return 'env-file';
  if (process.env.GCP_SA_JSON_BASE64) return 'env-base64';
  return 'none';
}

function settingsPayload(s) {
  return {
    provider: 'vertex',
    vertexProjectId: s.vertexProjectId || getProjectId() || '',
    vertexLocation: s.vertexLocation || process.env.GCP_LOCATION || 'us-central1',
    vertexModel: s.vertexModel || 'gemini-2.5-flash',
    enabled: s.enabled,
    hasCredentials: googleConfigured(),
    credentialSource: credentialSource(),
    prompts: s.prompts,
    defaults: DEFAULT_PROMPTS,
  };
}

router.get('/ai/settings', async (_req, res) => {
  res.json(settingsPayload(await getAiSettings()));
});

router.put('/ai/settings', async (req, res) => {
  const s = await getAiSettings();
  const { vertexProjectId, vertexLocation, vertexModel, enabled, prompts } = req.body || {};
  if (typeof vertexProjectId === 'string') s.vertexProjectId = vertexProjectId.trim();
  if (typeof vertexLocation === 'string' && vertexLocation.trim()) s.vertexLocation = vertexLocation.trim();
  if (typeof vertexModel === 'string' && vertexModel.trim()) s.vertexModel = vertexModel.trim();
  if (typeof enabled === 'boolean') s.enabled = enabled;
  if (prompts && typeof prompts === 'object') {
    if (typeof prompts.atsScore === 'string') s.prompts.atsScore = prompts.atsScore;
    if (typeof prompts.placementReadiness === 'string') s.prompts.placementReadiness = prompts.placementReadiness;
  }
  await s.save();
  res.json(settingsPayload(s));
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
