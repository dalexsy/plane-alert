#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(saPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(saPath)),
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'plane-alert-800ff',
  });
}

const db = admin.firestore();
const outDir = path.join(__dirname, '..', '..', 'scripts');

async function exportCollection(name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const out = path.join(outDir, `firestore-export-${name}.json`);
  fs.writeFileSync(out, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`[ok] ${name}: ${docs.length} docs -> ${out}`);
  return docs;
}

(async () => {
  for (const name of ['deviceTokens', 'deviceRegistrations']) {
    await exportCollection(name);
  }
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});