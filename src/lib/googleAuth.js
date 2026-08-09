/**
 * Single source of Google Cloud credentials, shared by GCS (video hosting) and
 * Vertex AI. No secrets are committed — the service-account JSON is provided at
 * runtime via env / a Render Secret File.
 *
 * Resolution order:
 *   1. GCP_SA_JSON_BASE64            — base64 of the SA JSON (single-line, env-safe)
 *   2. GOOGLE_APPLICATION_CREDENTIALS — path to a mounted JSON file (GoogleAuth/ADC reads it)
 * An explicit credentials object may also be passed in (e.g. a DB override).
 */
import { GoogleAuth } from 'google-auth-library';

let _creds;
let _credsResolved = false;

export function getCredentials() {
  if (_credsResolved) return _creds;
  _credsResolved = true;
  const b64 = process.env.GCP_SA_JSON_BASE64;
  if (b64) {
    try {
      _creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch {
      _creds = undefined;
    }
  }
  return _creds;
}

export function getProjectId() {
  return process.env.GCP_PROJECT_ID || getCredentials()?.project_id || '';
}

/** True when some usable credential source is present. */
export function googleConfigured() {
  return !!(process.env.GCP_SA_JSON_BASE64 || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

const _authByScope = {};

/**
 * Get a memoized GoogleAuth for the given scope(s). Pass `credentialsOverride`
 * (a parsed SA JSON) to use a specific credential — not cached in that case.
 */
export function getGoogleAuth(scopes, credentialsOverride) {
  const opts = { scopes };
  const creds = credentialsOverride || getCredentials();
  if (creds) opts.credentials = creds; // base64 / DB override
  // else GoogleAuth falls back to GOOGLE_APPLICATION_CREDENTIALS / ADC automatically
  if (process.env.GCP_PROJECT_ID) opts.projectId = process.env.GCP_PROJECT_ID;

  if (credentialsOverride) return new GoogleAuth(opts);
  const key = Array.isArray(scopes) ? scopes.join(',') : String(scopes || '');
  return (_authByScope[key] ||= new GoogleAuth(opts));
}
