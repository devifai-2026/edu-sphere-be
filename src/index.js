import 'dotenv/config';
// Must be imported before any routes are defined — it patches Express's
// Router/Route prototypes so a rejected promise inside an async handler is
// forwarded to the error middleware below instead of crashing the process.
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { connectDB } from './lib/db.js';
import { adminAuth } from './middleware/auth.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { rateLimit } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import appRoutes from './routes/app.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/uploads.js';
import trackRoutes from './routes/track.js';
import adminAnalyticsRoutes from './routes/adminAnalytics.js';
import aiRoutes from './routes/ai.js';
import adminAiRoutes from './routes/adminAi.js';

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy — needed for req.ip to reflect the real client
app.use(cors({ origin: '*' }));
// 20mb, not 2mb: base64-encoded resumes/images run ~33% larger than their
// raw bytes, and the multipart upload path already allows files up to 15mb.
app.use(express.json({ limit: '20mb' }));
app.use(sanitizeInput);

app.get('/health', (_req, res) => res.json({ ok: true }));

const otpLimiter = rateLimit({ windowMs: 60_000, max: 5, keyField: 'phone' });
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, keyField: 'email' });

// App-facing
app.use('/auth/otp/request', otpLimiter);
app.use('/auth/otp/verify', otpLimiter);
app.use('/auth', authRoutes);
app.use('/api/uploads', uploadRoutes); // multipart image upload (user or admin)
app.use('/api/track', trackRoutes);    // behavioral event ingest (user JWT)
app.use('/api/ai', aiRoutes);          // Gemini AI features (user JWT)
app.use('/api', appRoutes);

// Admin
app.use('/admin/login', loginLimiter);
app.use('/admin', adminAuthRoutes);              // /admin/login (public)
app.use('/admin', adminAuth, adminAnalyticsRoutes); // analytics (admin JWT)
app.use('/admin', adminAuth, adminAiRoutes);     // AI settings + logs (admin JWT)
app.use('/admin', adminAuth, adminRoutes);       // everything else requires admin JWT

// 404 + error handler
app.use((_req, res) => res.status(404).json({ error: 'not found' }));
app.use((err, _req, res, _next) => {
  if (err.name === 'CastError') return res.status(400).json({ error: `invalid ${err.path}` });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'already exists', field: Object.keys(err.keyPattern || {})[0] });
  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message });
  }
  // body-parser errors — malformed JSON and oversized bodies both fell
  // through to the generic 500 branch below instead of a client-fixable 4xx.
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'request body too large' });
  // body-parser's JSON strict-mode error is a bare SyntaxError with every
  // property except stack/message stripped (no .type/.status marker to key
  // off) — but since it's thrown synchronously while parsing the body,
  // before any route handler runs, seeing one here is unambiguously a
  // malformed-request-body case, not an app bug elsewhere.
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'malformed request body' });
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

// Defense in depth: express-async-errors covers every route handler above,
// so this should rarely fire — but if some stray promise elsewhere rejects,
// log it instead of taking the whole API down for every concurrent user.
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edusphere')
  .then(() => app.listen(PORT, () => console.log(`[api] listening on :${PORT}`)))
  .catch((e) => {
    console.error('[api] failed to start:', e);
    process.exit(1);
  });
