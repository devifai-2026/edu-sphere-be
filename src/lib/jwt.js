import jwt from 'jsonwebtoken';

const SECRET = () => process.env.JWT_SECRET || 'change-me-in-production';

export function sign(payload, opts = {}) {
  return jwt.sign(payload, SECRET(), { expiresIn: '30d', ...opts });
}

export function verify(token) {
  return jwt.verify(token, SECRET());
}
