import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

const REPLACEMENTS = [
  [/admin\.firestore\.DocumentReference/g, "LocalDocumentReference"],
  [/admin\.firestore\.QueryDocumentSnapshot/g, "LocalDocumentSnapshot"],
  [/admin\.firestore\.DocumentSnapshot/g, "LocalDocumentSnapshot"],
  [/admin\.firestore\.QuerySnapshot/g, "LocalQuerySnapshot"],
  [/admin\.firestore\.CollectionReference/g, "LocalCollectionReference"],
  [/admin\.firestore\.Transaction/g, "LocalTransaction"],
  [/admin\.firestore\.DocumentData/g, "DocData"],
  [/FirebaseFirestore\.DocumentReference/g, "LocalDocumentReference"],
  [/FirebaseFirestore\.QueryDocumentSnapshot/g, "LocalDocumentSnapshot"],
  [/FirebaseFirestore\.DocumentSnapshot/g, "LocalDocumentSnapshot"],
  [/FirebaseFirestore\.QuerySnapshot/g, "LocalQuerySnapshot"],
  [/FirebaseFirestore\.DocumentData/g, "DocData"],
  [/FirebaseFirestore\.Firestore/g, "LocalFirestore"],
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

function ensureImports(file, t) {
  const needs = [];
  if (/LocalDocumentReference/.test(t) && !/import[^;]*LocalDocumentReference/.test(t)) {
    needs.push("LocalDocumentReference");
  }
  if (/LocalDocumentSnapshot/.test(t) && !/import[^;]*LocalDocumentSnapshot/.test(t)) {
    needs.push("LocalDocumentSnapshot");
  }
  if (/LocalQuerySnapshot/.test(t) && !/import[^;]*LocalQuerySnapshot/.test(t)) {
    needs.push("LocalQuerySnapshot");
  }
  if (/LocalCollectionReference/.test(t) && !/import[^;]*LocalCollectionReference/.test(t)) {
    needs.push("LocalCollectionReference");
  }
  if (/LocalTransaction/.test(t) && !/import[^;]*LocalTransaction/.test(t)) {
    needs.push("LocalTransaction");
  }
  if (/DocData/.test(t) && !/import[^;]*DocData/.test(t) && !/type DocData/.test(t)) {
    // import from write util
  }
  if (!needs.length) return t;

  let rel = path
    .relative(path.dirname(file), path.join(root, "services/local-firestore-refs"))
    .split(path.sep)
    .join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `import { ${needs.join(", ")} } from '${rel}';\n` + t;
}

function ensureDocData(file, t) {
  if (!/\bDocData\b/.test(t) || /import[^;]*DocData/.test(t) || /export type DocData/.test(t)) {
    return t;
  }
  let rel = path
    .relative(
      path.dirname(file),
      path.join(root, "services/local-firestore-write.util"),
    )
    .split(path.sep)
    .join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `import type { DocData } from '${rel}';\n` + t;
}

for (const file of walk(root)) {
  if (file.includes("admin-compat") || file.includes("local-firestore")) continue;
  let t = fs.readFileSync(file, "utf8");
  const orig = t;
  for (const [re, to] of REPLACEMENTS) t = t.replace(re, to);
  // cast helpers for strict DeviceRegistration conversions
  t = t.replace(
    /as DeviceRegistration/g,
    "as unknown as DeviceRegistration",
  );
  t = t.replace(
    /as MilitaryHistorySighting/g,
    "as unknown as MilitaryHistorySighting",
  );
  t = t.replace(
    /as CachedFlightData/g,
    "as unknown as CachedFlightData",
  );
  // double-unknown fix
  t = t.replace(/as unknown as unknown as /g, "as unknown as ");
  t = ensureImports(file, t);
  t = ensureDocData(file, t);
  if (t !== orig) {
    fs.writeFileSync(file, t);
    console.log("fixed", path.relative(root, file));
  }
}
