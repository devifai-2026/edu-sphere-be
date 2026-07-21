import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './lib/db.js';
import { adminAuth } from './middleware/auth.js';
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
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// App-facing
app.use('/auth', authRoutes);
app.use('/api/uploads', uploadRoutes); // multipart image upload (user or admin)
app.use('/api/track', trackRoutes);    // behavioral event ingest (user JWT)
app.use('/api/ai', aiRoutes);          // Gemini AI features (user JWT)
app.use('/api', appRoutes);

// Admin
app.use('/admin', adminAuthRoutes);              // /admin/login (public)
app.use('/admin', adminAuth, adminAnalyticsRoutes); // analytics (admin JWT)
app.use('/admin', adminAuth, adminAiRoutes);     // AI settings + logs (admin JWT)
app.use('/admin', adminAuth, adminRoutes);       // everything else requires admin JWT

// 404 + error handler
app.use((_req, res) => res.status(404).json({ error: 'not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edusphere')
  .then(() => app.listen(PORT, () => console.log(`[api] listening on :${PORT}`)))
  .catch((e) => {
    console.error('[api] failed to start:', e);
    process.exit(1);
  });
