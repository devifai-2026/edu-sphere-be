/**
 * Fetch a saved resume/PDF URL and extract content for AI analysis.
 * Best-effort: returns empty content on any failure so the caller can
 * proceed profile-only.
 */
import { createRequire } from 'module';
import { sniffType } from './fileSniff.js';
const require = createRequire(import.meta.url);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Gemini accepts larger, but keep the request lean

/**
 * Fetch a saved resume URL and turn it into whatever the AI can actually read:
 *  - a PDF gets text-extracted as before
 *  - an image (a resume screenshot/photo — common for students without a PDF)
 *    is instead handed to Gemini as an inline vision part, since pdf-parse
 *    can't read it and would previously just silently return '' (score
 *    computed off zero resume content, a confusing dead end).
 * Returns { text, imagePart } — at most one of the two is populated.
 */
export async function extractResumeContent(url) {
  if (!url) return { text: '', imagePart: null };
  try {
    const res = await fetch(url);
    if (!res.ok) return { text: '', imagePart: null };
    const buf = Buffer.from(await res.arrayBuffer());
    const type = sniffType(buf);
    if (type === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buf);
      return { text: (data.text || '').replace(/\s+\n/g, '\n').trim().slice(0, 12000), imagePart: null };
    }
    if (type?.startsWith('image/') && buf.length <= MAX_IMAGE_BYTES) {
      return { text: '', imagePart: { mimeType: type, data: buf.toString('base64') } };
    }
    return { text: '', imagePart: null };
  } catch (e) {
    console.error('[pdf] extractResumeContent failed:', e?.message || e);
    return { text: '', imagePart: null };
  }
}
