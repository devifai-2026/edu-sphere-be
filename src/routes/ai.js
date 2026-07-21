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
import { generateJson } from '../lib/gemini.js';
import { extractPdfText } from '../lib/pdf.js';

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

async function runFeature({ feature, promptKey, userId, buildContent }) {
  const settings = await getAiSettings();
  const apiKey = settings.geminiApiKey; // stored in DB only
  const systemPrompt = settings.prompts?.[promptKey];
  const model = settings.model || 'gemini-2.0-flash';

  const u = await User.findById(userId).lean();
  if (!u) throw Object.assign(new Error('user not found'), { status: 404 });
  const userContent = buildContent(u);

  const started = Date.now();
  const log = { user: userId, feature, model, input: `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userContent}` };
  try {
    if (!apiKey) throw new Error('AI not configured — set the Gemini API key in admin settings.');
    const { text, parsed } = await generateJson({ apiKey, model, systemPrompt, userContent });
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
    // If no text supplied, parse the user's saved CV PDF.
    if (!resumeText) {
      const u = await User.findById(req.user.sub).lean();
      if (u?.cvUrl) resumeText = await extractPdfText(u.cvUrl);
    }
    const result = await runFeature({
      feature: 'atsScore',
      promptKey: 'atsScore',
      userId: req.user.sub,
      buildContent: (u) => profileSummary(u, resumeText ? `\nResume text (extracted):\n${resumeText}` : '\n(No resume uploaded — evaluate profile only and advise uploading a resume.)'),
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
