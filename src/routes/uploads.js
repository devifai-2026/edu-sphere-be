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
import { anyAuth } from '../middleware/auth.js';
import { uploadImage, uploadsConfigured } from '../lib/uploads.js';

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
  try {
    const folder = req.admin ? 'edusphere/content' : 'edusphere/users';
    const result = await uploadImage(req.file.buffer, { folder });
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
  try {
    const folder = req.admin ? 'edusphere/content' : 'edusphere/users';
    const result = await uploadImage(buffer, { folder });
    res.status(201).json(result);
  } catch (e) {
    console.error('[uploads/base64] failed:', e?.message || e);
    res.status(502).json({ error: 'upload failed' });
  }
});

export default router;
