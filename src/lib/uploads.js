/**
 * Image upload helper. Uploads a buffer to Cloudinary (signed, server-side),
 * falling back to ImageBB when Cloudinary is unavailable or fails.
 *
 * Env:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   IMGBB_API_KEY
 */
import { v2 as cloudinary } from 'cloudinary';

let configured = false;
function ensureCloudinary() {
  if (configured) return cloudinaryReady;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  cloudinaryReady = Boolean(cloud_name && api_key && api_secret);
  if (cloudinaryReady) {
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  }
  configured = true;
  return cloudinaryReady;
}
let cloudinaryReady = false;

/** Upload to Cloudinary from a Buffer. Resolves to { url, publicId }. */
function uploadToCloudinary(buffer, { folder = 'edusphere', resourceType = 'auto', format } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, ...(format ? { format } : {}) },
      (err, result) => {
        if (err || !result) return reject(err || new Error('cloudinary: empty result'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/** Upload to ImageBB (fallback). Resolves to { url, publicId }. */
async function uploadToImgbb(buffer) {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error('imgbb: IMGBB_API_KEY not set');
  const body = new URLSearchParams();
  body.append('image', buffer.toString('base64'));
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(`imgbb: ${json?.error?.message || res.status}`);
  }
  return { url: json.data.url, publicId: json.data.id };
}

/**
 * Upload an image buffer. Tries Cloudinary, then ImageBB.
 * @returns {Promise<{ url: string, provider: 'cloudinary'|'imgbb', publicId: string }>}
 */
export async function uploadImage(buffer, opts = {}) {
  if (ensureCloudinary()) {
    try {
      const r = await uploadToCloudinary(buffer, opts);
      return { ...r, provider: 'cloudinary' };
    } catch (e) {
      console.error('[uploads] cloudinary failed, falling back to imgbb:', e?.message || e);
    }
  }
  const r = await uploadToImgbb(buffer);
  return { ...r, provider: 'imgbb' };
}

/** True if at least one upload provider is configured. */
export function uploadsConfigured() {
  return ensureCloudinary() || Boolean(process.env.IMGBB_API_KEY);
}
