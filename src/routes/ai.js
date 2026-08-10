/**
 * AI features (Gemini-powered), mounted at /api/ai. User-authed.
 *   POST /api/ai/ats        — resume ATS score + suggestions
 *   POST /api/ai/placement  — placement readiness score + breakdown
 * Every call is recorded in LlmLog for the admin audit tab.
 */
import { Router } from 'express';
import { userAuth } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { getAiSettings, LlmLog } from '../models/aiSettings.js';
import { generateJson } from '../lib/vertex.js';
import { googleConfigured, getProjectId } from '../lib/googleAuth.js';
import { extractResumeContent } from '../lib/pdf.js';

const router = Router();

function profileSummary(u, extra = '') {
  return [
    `Name: ${u.firstName} ${u.lastName}`.trim(),
    `Degree/Stream/Year: ${u.degree} / ${u.stream} / ${u.year}`,
    `College: ${u.college}`,
    `Skills: ${(u.skills || []).join(', ') || 'none listed'}`,
    `Projects: ${(u.projects || []).map((p) => `${p.title} (${p.meta})`).join('; ') || 'none'}`,
    `Certificates: ${(u.certificates || []).map((c) => `${c.title} — ${c.issuer} ${c.year}`).join('; ') || 'none'}`,
    `Tests completed: ${u.testsCompleted || 0}`,
    `Has resume on file: ${u.cvUrl ? 'yes' : 'no'}`,
    extra,
  ].filter(Boolean).join('\n');
}

async function runFeature({ feature, promptKey, userId, buildContent, imageParts }) {
  const settings = await getAiSettings();
  const systemPrompt = settings.prompts?.[promptKey];
  const projectId = settings.vertexProjectId || getProjectId();
  const location = settings.vertexLocation || process.env.GCP_LOCATION || 'us-central1';
  const model = settings.vertexModel || 'gemini-2.5-flash';

  const u = await User.findById(userId).lean();
  if (!u) throw Object.assign(new Error('user not found'), { status: 404 });
  const userContent = buildContent(u);

  const started = Date.now();
  const log = { user: userId, feature, model, input: `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userContent}` };
  try {
    if (!settings.enabled) throw new Error('AI is disabled in admin settings.');
    if (!projectId || !googleConfigured()) throw new Error('AI not configured — set the Vertex project and service-account credentials.');
    const { text, parsed } = await generateJson({ projectId, location, model, systemPrompt, userContent, imageParts });
    log.output = text;
    log.parsed = parsed;
    log.status = parsed ? 'ok' : 'error';
    if (!parsed) log.error = 'model did not return valid JSON';
    log.latencyMs = Date.now() - started;
    await LlmLog.create(log);
    if (!parsed) throw new Error('AI returned an unexpected format. Please retry.');
    return parsed;
  } catch (e) {
    log.status = 'error';
    log.error = e.message || String(e);
    log.latencyMs = Date.now() - started;
    await LlmLog.create(log).catch(() => {});
    throw e;
  }
}

router.post('/ats', userAuth, async (req, res) => {
  try {
    let resumeText = (req.body?.resumeText || '').slice(0, 12000);
    let imagePart = null;
    // If no text supplied, read the user's saved CV — a PDF gets text-extracted,
    // an image (common for students without a proper PDF) is handed to Gemini
    // directly as a vision input instead of silently yielding empty text.
    if (!resumeText) {
      const u = await User.findById(req.user.sub).lean();
      if (u?.cvUrl) {
        const content = await extractResumeContent(u.cvUrl);
        resumeText = content.text;
        imagePart = content.imagePart;
      }
    }
    const note = resumeText
      ? `\nResume text (extracted):\n${resumeText}`
      : imagePart
        ? '\nA resume image is attached — read it directly to evaluate content, formatting and ATS-friendliness.'
        : '\n(No resume uploaded — evaluate profile only and advise uploading a resume.)';
    const result = await runFeature({
      feature: 'atsScore',
      promptKey: 'atsScore',
      userId: req.user.sub,
      buildContent: (u) => profileSummary(u, note),
      imageParts: imagePart ? [imagePart] : [],
    });
    res.json(result);
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message || 'AI request failed' });
  }
});

router.post('/placement', userAuth, async (req, res) => {
  try {
    const result = await runFeature({
      feature: 'placementReadiness',
      promptKey: 'placementReadiness',
      userId: req.user.sub,
      buildContent: (u) => profileSummary(u),
    });
    // Persist score + readiness back onto the profile so other screens can read it.
    if (typeof result.placementScore === 'number') {
      await User.updateOne(
        { _id: req.user.sub },
        { $set: { placementScore: result.placementScore, readiness: Array.isArray(result.readiness) ? result.readiness : [] } }
      );
    }
    res.json(result);
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message || 'AI request failed' });
  }
});

export default router;
