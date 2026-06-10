const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sharedDir = path.join(repoRoot, "shared");
const functionsDir = path.join(repoRoot, "functions");
const outputDir = path.join(functionsDir, "shared-package");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const pkg = JSON.parse(
  fs.readFileSync(path.join(sharedDir, "package.json"), "utf8")
);

const minimalPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: pkg.main,
  module: pkg.module,
  types: pkg.types,
  exports: pkg.exports,
  license: pkg.license,
  keywords: pkg.keywords,
};

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "package.json"),
  JSON.stringify(minimalPkg, null, 2)
);

copyDir(path.join(sharedDir, "dist"), path.join(outputDir, "dist"));
copyDir(path.join(sharedDir, "data"), path.join(outputDir, "data"));

console.log("Prepared shared package for functions:", outputDir);
