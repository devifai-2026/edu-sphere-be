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

/** <folder>/YYYY/MM/<uuid>.<ext> — random key so public URLs aren't enumerable. */
export function buildObjectKey(filename = '', folder = 'videos') {
  const m = String(filename).match(EXT_RE);
  const ext = (m ? m[1] : folder === 'docs' ? 'pdf' : 'mp4').toLowerCase();
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${folder}/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

export function publicUrl(key) {
  return `https://storage.googleapis.com/${BUCKET}/${key}`;
}

/** Direct server-side upload (small files — PDFs/docs already pass through this server). */
export async function uploadBuffer(buffer, { key, contentType }) {
  await storage().bucket(BUCKET).file(key).save(buffer, { contentType, resumable: false });
  return publicUrl(key);
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

const READ_URL_TTL_MS = 6 * 60 * 60 * 1000; // 6h — long enough for one viewing session, short enough to limit redistribution

/**
 * v4 signed GET URL — used instead of the permanent public objectUrl so an
 * uploaded lecture video isn't a forever-public, freely re-shareable link.
 * NOTE: this only actually restricts access once the bucket's `allUsers`
 * Storage Object Viewer grant is removed — with that grant still in place,
 * the plain public URL keeps working alongside this one. See the deploy note
 * left for the team: that IAM change should happen only after this code is
 * live on the deployed backend, or existing plain links break immediately.
 */
export async function signReadUrl(key) {
  const [url] = await storage()
    .bucket(BUCKET)
    .file(key)
    .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + READ_URL_TTL_MS });
  return url;
}

/** Extract the object key back out of one of our own public GCS URLs, or null if it isn't one. */
export function keyFromPublicUrl(url) {
  const prefix = `https://storage.googleapis.com/${BUCKET}/`;
  return typeof url === 'string' && url.startsWith(prefix) ? url.slice(prefix.length) : null;
}
