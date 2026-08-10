/**
 * Magic-byte sniffing so upload type checks can't be bypassed by lying about
 * the declared Content-Type/mimetype (which is exactly what multer's
 * `fileFilter` and the base64 route previously trusted blindly).
 */
const SIGNATURES = [
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], extra: (buf) => buf.slice(8, 12).toString('ascii') === 'WEBP' },
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] }, // .docx/.xlsx/.pptx are zip containers
  { type: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // legacy .doc (OLE compound file)
];

export function sniffType(buffer) {
  for (const sig of SIGNATURES) {
    if (buffer.length < sig.bytes.length) continue;
    if (!sig.bytes.every((b, i) => buffer[i] === b)) continue;
    if (sig.extra && !sig.extra(buffer)) continue;
    return sig.type;
  }
  return null;
}

const ALLOWED_REAL_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'application/zip', 'application/msword',
]);

export function isAllowedUpload(buffer) {
  const real = sniffType(buffer);
  return !!real && ALLOWED_REAL_TYPES.has(real);
}
