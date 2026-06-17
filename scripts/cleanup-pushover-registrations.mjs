#!/usr/bin/env node
/** One-shot: remove Firestore device registrations that do not match Pushover. */
const endpoint =
  'https://europe-west3-plane-alert-800ff.cloudfunctions.net/unsubscribeDevice';

const removeIds = [
  'u4h7b5hnvdgvozqd5yzm86i474fs4g__browser-macintel',
  'u4h7b5hnvdgvozqd5yzm86i474fs4g__browser-windows',
  'u4h7b5hnvdgvozqd5yzm86i474fs4g__mobile-android',
  'u4h7b5hnvdgvozqd5yzm86i474fs4g__phone',
  'u4h7b5hnvdgvozqd5yzm86i474fs4g__desktop',
  'eMsUXgByiMsT2mmaLkt9bZ:APA91bEPHQdQG_PpZhgU-d3SAPYVDSBZi0cR4y8s_vlwxHaFM8F_QO2Tf_pZOIgrCdD9364ai4x8NxzZ4oGqdvVIHj-Qapx2EdDXeAvnTviLjOpF0ViRSNM',
];

async function main() {
  for (const deviceId of removeIds) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const body = await res.text();
    console.log(res.ok ? 'removed' : 'FAILED', deviceId.slice(0, 48), body);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
