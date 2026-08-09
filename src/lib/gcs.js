/**
 * Google Cloud Storage helper for lecture-video hosting.
 *
 * Videos are uploaded straight from the admin browser to GCS via short-lived v4
 * signed PUT URLs (so large files never traverse the backend / Render's body
 * limit). Objects are stored under random UUID keys and served from a stable
 * public URL (bucket grants allUsers → Storage Object Viewer).
 */
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { getCredentials, getProjectId, googleConfigured } from './googleAuth.js';

const BUCKET = process.env.GCS_BUCKET || '';

let _storage;
function storage() {
  if (_storage) return _storage;
  const opts = {};
  const projectId = getProjectId();
  if (projectId) opts.projectId = projectId;
  const creds = getCredentials();
  if (creds) opts.credentials = creds; // else uses GOOGLE_APPLICATION_CREDENTIALS / ADC
  _storage = new Storage(opts);
  return _storage;
}

export function gcsConfigured() {
  return !!BUCKET && googleConfigured();
}

const EXT_RE = /\.([a-z0-9]+)$/i;

/** videos/YYYY/MM/<uuid>.<ext> — random key so public URLs aren't enumerable. */
export function buildObjectKey(filename = '') {
  const m = String(filename).match(EXT_RE);
  const ext = (m ? m[1] : 'mp4').toLowerCase();
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `videos/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

export function publicUrl(key) {
  return `https://storage.googleapis.com/${BUCKET}/${key}`;
}

/** v4 signed PUT URL the browser uploads to directly. */
export async function signUploadUrl({ contentType, key }) {
  const [uploadUrl] = await storage()
    .bucket(BUCKET)
    .file(key)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 30 * 60 * 1000, // 30 min
      contentType,
    });
  return { uploadUrl, key, objectUrl: publicUrl(key), headers: { 'Content-Type': contentType } };
}
