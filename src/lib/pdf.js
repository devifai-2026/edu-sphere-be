/**
 * Fetch a PDF (or Cloudinary raw) URL and extract its text for AI analysis.
 * Best-effort: returns '' on any failure so the caller can proceed profile-only.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export async function extractPdfText(url) {
  if (!url) return '';
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    // pdf-parse is CommonJS; require lazily so a parse failure can't crash boot.
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buf);
    return (data.text || '').replace(/\s+\n/g, '\n').trim().slice(0, 12000);
  } catch (e) {
    console.error('[pdf] extract failed:', e?.message || e);
    return '';
  }
}
