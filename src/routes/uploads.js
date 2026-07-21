/**
 * Image upload route. Accepts a multipart `file`, uploads via Cloudinary
 * (ImageBB fallback), and returns the hosted URL.
 *
 * Auth: any authenticated principal (user for avatar/portfolio, admin for content).
 * Mounted at /api/uploads.
 */
import { Router } from 'express';
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

export default router;
