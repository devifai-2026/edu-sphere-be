/**
 * Minimal Gemini (Google Generative Language API) client.
 * Uses the REST generateContent endpoint so we need no extra SDK.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Call Gemini with a system prompt + user content, expecting JSON back.
 * @returns {Promise<{ text: string, parsed: any|null }>}
 */
export async function generateJson({ apiKey, model = 'gemini-2.0-flash', systemPrompt, userContent }) {
  if (!apiKey) throw new Error('gemini: missing API key');

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`gemini: ${msg}`);
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
    // Try to extract the first {...} block.
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    return null;
  }
}
