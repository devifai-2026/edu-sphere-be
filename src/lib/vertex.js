/**
 * Vertex AI client. Calls the regional generateContent endpoint with an OAuth
 * bearer token minted from the service account (via googleAuth.js). Keeps the
 * same generateJson() signature/return shape as the old AI-Studio client so the
 * callers in routes/ai.js barely change.
 */
import { getGoogleAuth } from './googleAuth.js';

/**
 * @returns {Promise<{ text: string, parsed: any|null }>}
 */
export async function generateJson({ projectId, location = 'us-central1', model, systemPrompt, userContent, imageParts = [] }) {
  if (!projectId) throw new Error('vertex: missing GCP project id');
  if (!model) throw new Error('vertex: missing model');

  const auth = getGoogleAuth('https://www.googleapis.com/auth/cloud-platform');
  const token = await auth.getAccessToken();
  if (!token) throw new Error('vertex: could not obtain an access token — check service-account credentials');

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

  // imageParts lets callers attach inline images (e.g. a resume screenshot the
  // model can read directly) alongside the text prompt — Gemini is multimodal.
  const parts = [
    { text: userContent },
    ...imageParts.map((p) => ({ inline_data: { mime_type: p.mimeType, data: p.data } })),
  ];
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || (Array.isArray(json) ? json[0]?.error?.message : '') || `HTTP ${res.status}`;
    throw new Error(`vertex: ${msg}`);
  }

  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return { text, parsed: safeParseJson(text) };
}

/** Tolerant JSON parse — strips markdown fences if the model added them. */
function safeParseJson(text) {
  if (!text) return null;
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    return null;
  }
}
