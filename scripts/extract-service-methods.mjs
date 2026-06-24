#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('Usage: node scripts/extract-service-methods.mjs <service.ts> [...]');
  process.exit(1);
}

function findMatchingBrace(lines, startIdx) {
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') {
        depth--;
        if (started && depth === 0) return i;
      }
    }
  }
  return lines.length - 1;
}

function classNameFrom(text) {
  return text.match(/export class (\w+)/)?.[1] ?? 'UnknownService';
}

for (const filePath of targets) {
  const abs = path.resolve(filePath);
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split(/\r?\n/);
  const className = classNameFrom(src);
  const baseName = path.basename(abs, '.service.ts');
  const dir = path.dirname(abs);
  const utilDir = path.join(dir, baseName);
  fs.mkdirSync(utilDir, { recursive: true });
  const utilPath = path.join(utilDir, `${baseName}-private.util.ts`);

  const methodStarts = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\bprivate\s+(async\s+)?\w+\(/.test(lines[i])) methodStarts.push(i);
  }
  if (!methodStarts.length) {
    console.log(`${baseName}: no private methods`);
    continue;
  }

  const extracted = [
    `/* Extracted from ${path.basename(abs)} */`,
    `import type { ${className} } from '../${path.basename(abs, '.ts')}';`,
    '',
    `export type Ctx = ${className};`,
    '',
  ];
  const replacements = [];

  for (const start of methodStarts) {
    const sigLine = lines[start];
    const sigMatch = sigLine.match(/private\s+(async\s+)?(\w+)\(([^)]*)\)/);
    if (!sigMatch) continue;
    const isAsync = !!sigMatch[1];
    const name = sigMatch[2];
    const params = sigMatch[3].trim();
    const end = findMatchingBrace(lines, start);
    const bodyLines = lines.slice(start + 1, end);
    const fnParams = params ? `ctx: Ctx, ${params}` : 'ctx: Ctx';
    extracted.push(`export ${isAsync ? 'async ' : ''}function ${name}(${fnParams}) {`);
    for (const bl of bodyLines) extracted.push(bl.replace(/\bthis\./g, 'ctx.'));
    extracted.push('}');
    extracted.push('');
    replacements.push({ start, end, name, params, isAsync });
  }

  const newLines = [...lines];
  for (const info of [...replacements].sort((a, b) => b.start - a.start)) {
    const callParams = info.params ? `this, ${info.params}` : 'this';
    newLines.splice(info.start, info.end - info.start + 1,
      `  private ${info.isAsync ? 'async ' : ''}${info.name}(${info.params}) {`,
      `    return ${info.name}Impl(${callParams});`,
      '  }'
    );
  }

  let lastImport = 0;
  for (let i = 0; i < newLines.length; i++) if (/^import /.test(newLines[i])) lastImport = i;
  const imports = replacements.map((v) => `${v.name} as ${v.name}Impl`).join(', ');
  newLines.splice(lastImport + 1, 0, `import { ${imports} } from './${baseName}/${baseName}-private.util';`);

  fs.writeFileSync(utilPath, extracted.join('\n'));
  fs.writeFileSync(abs, newLines.join('\n'));
  console.log(`${baseName}: extracted ${replacements.length} methods → service ${newLines.length} lines, util ${extracted.length} lines`);
}
