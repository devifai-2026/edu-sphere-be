/**
 * Image/file upload route. Two entry points, both upload via Cloudinary
 * (ImageBB fallback) and return the hosted URL:
 *   POST /            — multipart `file` (works locally / most hosts)
 *   POST /base64      — JSON { data: "<base64>", mimeType } — passes cleanly
 *                       through proxies (Render/Cloudflare) that drop multipart.
 *
 * Auth: any authenticated principal (user for avatar/portfolio, admin for content).
 * Mounted at /api/uploads.
 */
import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import { anyAuth, adminAuth } from '../middleware/auth.js';
import { uploadImage, uploadsConfigured } from '../lib/uploads.js';
import { signUploadUrl, buildObjectKey, gcsConfigured, uploadBuffer } from '../lib/gcs.js';
import { isAllowedUpload, sniffType } from '../lib/fileSniff.js';

// This Cloudinary account has its default "PDF and ZIP files" delivery
// restriction on: a URL resolving to a .pdf/.zip extension 401s regardless of
// resource_type ('image' or 'raw' — confirmed both). That meant every
// note/PYQ PDF uploaded through this endpoint was silently unopenable for
// students. GCS (already used for lecture videos, confirmed publicly
// readable) has no such restriction, so non-image files go there instead;
// Cloudinary stays for actual images.
const RAW_CONTENT_TYPES = {
  'application/pdf': 'application/pdf',
  'application/msword': 'application/msword',
  'application/zip': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

async function storeUpload(buffer, { folder }) {
  const type = sniffType(buffer);
  if (type?.startsWith('image/')) {
    return uploadImage(buffer, { folder, resourceType: 'auto' });
  }
  if (gcsConfigured()) {
    const ext = type?.split('/').pop() || 'bin';
    const key = buildObjectKey(`file.${ext}`, 'docs');
    const url = await uploadBuffer(buffer, { key, contentType: RAW_CONTENT_TYPES[type] || 'application/octet-stream' });
    return { url, provider: 'gcs', publicId: key };
  }
  // No GCS configured — fall back to Cloudinary raw without an explicit
  // extension, which at least avoids the 401 (content-type won't be exact).
  return uploadImage(buffer, { folder, resourceType: 'raw' });
}

const router = Router();

// Keep files in memory; we stream the buffer straight to the provider.
const ALLOWED = /^image\/|^application\/pdf$|^application\/msword$|^application\/vnd\.openxmlformats/;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB (PDFs/resumes)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.test(file.mimetype)) cb(null, true);
    else cb(new Error('only image, PDF or Word files are allowed'));
  },
});

router.post('/', anyAuth, upload.single('file'), async (req, res) => {
  if (!uploadsConfigured()) {
    return res.status(503).json({ error: 'upload provider not configured' });
  }
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'no file provided (field name must be "file")' });
  }
  // The client-declared mimetype (checked by multer's fileFilter) is trivial
  // to spoof — confirm the actual bytes are a type we intend to host.
  if (!isAllowedUpload(req.file.buffer)) {
    return res.status(400).json({ error: 'file content does not match an allowed image/PDF/Word type' });
  }
  try {
    const folder = req.admin ? 'edusphere/content' : 'edusphere/users';
    const result = await storeUpload(req.file.buffer, { folder });
    res.status(201).json(result); // { url, provider, publicId }
  } catch (e) {
    console.error('[uploads] failed:', e?.message || e);
    res.status(502).json({ error: 'upload failed' });
  }
});

/** Base64 JSON upload — reliable through proxies that block multipart. */
router.post('/base64', anyAuth, express.json({ limit: '20mb' }), async (req, res) => {
  if (!uploadsConfigured()) return res.status(503).json({ error: 'upload provider not configured' });
  let data = req.body?.data;
  if (!data) return res.status(400).json({ error: 'no data (base64) provided' });
  // Strip a data URI prefix if present ("data:image/png;base64,....").
  const comma = data.indexOf('base64,');
  if (comma !== -1) data = data.slice(comma + 7);
  let buffer;
  try {
    buffer = Buffer.from(data, 'base64');
  } catch {
    return res.status(400).json({ error: 'invalid base64' });
  }
  if (!buffer.length) return res.status(400).json({ error: 'empty file' });
  // This path previously did zero type-checking — verify the actual bytes.
  if (!isAllowedUpload(buffer)) {
    return res.status(400).json({ error: 'file content does not match an allowed image/PDF/Word type' });
  }
  try {
    const folder = req.admin ? 'edusphere/content' : 'edusphere/users';
    const result = await storeUpload(buffer, { folder });
    res.status(201).json(result);
  } catch (e) {
    console.error('[uploads/base64] failed:', e?.message || e);
    res.status(502).json({ error: 'upload failed' });
  }
});

/**
 * Sign a direct-to-GCS upload for a lecture video (admin only). The browser then
 * PUTs the file straight to GCS using `uploadUrl`, bypassing this server entirely.
 */
router.post('/gcs-sign', adminAuth, express.json(), async (req, res) => {
  if (!gcsConfigured()) return res.status(503).json({ error: 'GCS not configured' });
  const { filename, contentType } = req.body || {};
  if (!contentType || !String(contentType).startsWith('video/')) {
    return res.status(400).json({ error: 'contentType must be a video/* type' });
  }
  try {
    const key = buildObjectKey(filename);
    const out = await signUploadUrl({ contentType, key });
    res.status(201).json(out); // { uploadUrl, objectUrl, key, headers }
  } catch (e) {
    console.error('[uploads/gcs-sign] failed:', e?.message || e);
    res.status(502).json({ error: 'could not sign upload url' });
  }
});

export default router;
