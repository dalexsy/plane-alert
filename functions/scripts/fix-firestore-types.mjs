import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  if (file.endsWith("admin-compat.ts") || file.endsWith("local-firestore.ts")) continue;
  let t = fs.readFileSync(file, "utf8");
  const orig = t;
  const hadType =
    /admin\.firestore\.Firestore/.test(t) || /firestore\.Firestore/.test(t);
  t = t.replace(/admin\.firestore\.Firestore/g, "LocalFirestore");
  t = t.replace(/\bfirestore\.Firestore\b/g, "LocalFirestore");
  // import type { firestore } usages → drop, use values from admin
  t = t.replace(
    /import\s+type\s+\{\s*firestore\s*\}\s+from\s+['"][^'"]+admin-compat['"];?\n?/g,
    "",
  );
  t = t.replace(
    /import\s+\{\s*firestore\s*\}\s+from\s+['"][^'"]+admin-compat['"];?\n?/g,
    (m) => {
      // keep if used as value
      return m;
    },
  );

  if (hadType && !/import[^;]*LocalFirestore/.test(t)) {
    let rel = path
      .relative(path.dirname(file), path.join(root, "local-firestore"))
      .split(path.sep)
      .join("/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    t = `import { LocalFirestore } from '${rel}';\n` + t;
  }

  // import type { firestore } from admin — some files use firestore.Timestamp as type
  t = t.replace(
    /import\s+type\s+\{\s*firestore\s+as\s+(\w+)\s*\}\s+from\s+['"][^'"]+admin-compat['"];?\n?/g,
    "",
  );

  if (t !== orig) {
    fs.writeFileSync(file, t);
    console.log("fixed", path.relative(root, file));
  }
}
