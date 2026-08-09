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

function relImport(fromFile, targetBase) {
  let rel = path
    .relative(path.dirname(fromFile), path.join(root, targetBase))
    .split(path.sep)
    .join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel.replace(/\.ts$/, "");
}

const skip = new Set(["admin-compat.ts", "pi-logger.ts", "on-request.ts"]);
const files = walk(root).filter((f) => !skip.has(path.basename(f)));
let n = 0;

for (const file of files) {
  let t = fs.readFileSync(file, "utf8");
  const orig = t;
  const adminPath = relImport(file, "admin-compat");
  const loggerPath = relImport(file, "pi-logger");
  const onReqPath = relImport(file, "on-request");

  t = t.replace(/from ['"]firebase-admin['"]/g, `from '${adminPath}'`);
  t = t.replace(/from ['"]firebase-functions\/v2\/https['"]/g, `from '${onReqPath}'`);
  t = t.replace(/from ['"]firebase-functions\/v2\/scheduler['"]/g, `from '${onReqPath}'`);
  t = t.replace(/from ['"]firebase-functions\/v2['"]/g, `from '${loggerPath}'`);
  t = t.replace(/from ['"]firebase-functions['"]/g, `from '${loggerPath}'`);

  if (t !== orig) {
    fs.writeFileSync(file, t);
    n += 1;
    console.log("updated", path.relative(root, file));
  }
}
console.log("files changed", n);
