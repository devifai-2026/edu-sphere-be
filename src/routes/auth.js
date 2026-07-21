import { Router } from 'express';
import { User } from '../models/user.js';
import { sign } from '../lib/jwt.js';
import * as S from '../lib/serialize.js';

const router = Router();

// Dummy OTP for now — real SMS provider comes later. Matches the app's DUMMY_OTP.
const DUMMY_OTP = '1111';

/** POST /auth/otp/request  { phone } — no-op (no SMS yet); app shows "Demo code: 1111". */
router.post('/otp/request', (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'invalid phone' });
  res.json({ ok: true, demoCode: DUMMY_OTP });
});

/** POST /auth/otp/verify  { phone, code } — accepts 1111, upserts user, issues JWT. */
router.post('/otp/verify', async (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'invalid phone' });
  if (code !== DUMMY_OTP) return res.status(401).json({ error: 'invalid code' });

  const user = await User.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone }, $set: { lastActiveAt: new Date() } },
    { upsert: true, new: true }
  );
  const token = sign({ kind: 'user', sub: String(user._id), phone });
  res.json({ token, user: S.userProfile(user) });
});

export default router;
