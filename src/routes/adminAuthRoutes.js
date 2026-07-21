import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/adminUser.js';
import { sign } from '../lib/jwt.js';

const router = Router();

/** POST /admin/login  { email, password } */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const admin = await AdminUser.findOne({ email: String(email).toLowerCase() });
  if (!admin) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = sign({ kind: 'admin', sub: String(admin._id), email: admin.email, role: admin.role });
  res.json({ token, admin: { id: String(admin._id), email: admin.email, role: admin.role } });
});

export default router;
