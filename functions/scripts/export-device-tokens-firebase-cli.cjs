#!/usr/bin/env node
/**
 * Export deviceTokens via Firestore REST + Firebase CLI refresh token.
 * No service account required when `firebase login` is active.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT = 'plane-alert-800ff';
const COLLECTIONS = [
  'deviceTokens',
  'deviceRegistrations',
  'military-history',
  'notification-cooldowns',
];
const outDir = path.join(__dirname, '..', '..', 'scripts');

function readFirebaseToolsConfig() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(home, '.config', 'configstore', 'firebase-tools.json'),
    path.join(
      process.env.APPDATA || '',
      '.config',
      'configstore',
      'firebase-tools.json',
    ),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    }
  }
  throw new Error('firebase-tools.json not found — run: firebase login');
}

function postForm(url, body) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(raw) });
          } catch {
            reject(new Error(`token exchange failed (${res.statusCode}): ${raw}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(raw) });
          } catch {
            reject(new Error(`firestore read failed (${res.statusCode}): ${raw}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue).getTime();
  if ('mapValue' in value) {
    const out = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue);
  }
  return value;
}

function decodeDocument(doc) {
  const data = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    data[k] = decodeFirestoreValue(v);
  }
  const id = doc.name.split('/').pop();
  return { id, data };
}

async function fetchCollection(token, collection) {
  const docs = [];
  let pageToken = '';
  do {
    const suffix = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}${suffix}`;
    const { status, json } = await getJson(url, token);
    if (status !== 200) {
      throw new Error(`Firestore ${collection} HTTP ${status}: ${JSON.stringify(json)}`);
    }
    for (const doc of json.documents || []) {
      docs.push(decodeDocument(doc));
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function resolveAccessToken(cfg) {
  const tokens = cfg?.tokens;
  if (!tokens?.access_token) {
    throw new Error('No access_token in firebase-tools.json — run: firebase login');
  }
  if (tokens.expires_at && tokens.expires_at > Date.now() + 60_000) {
    return tokens.access_token;
  }
  const refresh = tokens.refresh_token;
  if (!refresh) {
    throw new Error('Firebase access token expired — run: firebase login');
  }
  const { status, json } = await postForm('https://oauth2.googleapis.com/token', {
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaKbJVqS-mfQbQitq3i',
  });
  if (status !== 200 || !json.access_token) {
    throw new Error(`OAuth refresh failed (${status}) — run: firebase login`);
  }
  return json.access_token;
}

async function main() {
  const cfg = readFirebaseToolsConfig();
  const accessToken = await resolveAccessToken(cfg);

  for (const collection of COLLECTIONS) {
    const docs = await fetchCollection(accessToken, collection);
    const out = path.join(outDir, `firestore-export-${collection}.json`);
    fs.writeFileSync(out, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`[ok] ${collection}: ${docs.length} docs -> ${out}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});