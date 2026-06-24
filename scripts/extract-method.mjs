import fs from 'fs';
import path from 'path';

const [file, methodName, outFile, serviceName] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (
    lines[i].includes(`${methodName}(`) &&
    (/\b(private|public|async)\b/.test(lines[i]) || lines[i].trim().startsWith(`${methodName}(`))
  ) {
    start = i;
    break;
  }
}
if (start < 0) throw new Error(`Method ${methodName} not found`);
let depth = 0;
let started = false;
let end = start;
for (let i = start; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') {
      depth++;
      started = true;
    } else if (ch === '}') {
      depth--;
      if (started && depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (started && depth === 0) break;
}
const sig = lines[start];
const body = lines.slice(start + 1, end).map((l) => l.replace(/\bthis\./g, 'ctx.'));
const paramMatch = sig.match(/\(([^)]*)\)/);
const params = paramMatch ? paramMatch[1].trim() : '';
const isAsync = /\basync\b/.test(sig);
const fnParams = params ? `ctx, ${params}` : 'ctx';
const content = [
  `import type { ${serviceName} } from '../${path.basename(file, '.ts')}';`,
  '',
  `export type Ctx = ${serviceName};`,
  '',
  `export ${isAsync ? 'async ' : ''}function ${methodName}(${fnParams}) {`,
  ...body,
  '}',
  '',
].join('\n');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Wrote ${methodName} (${end - start + 1} lines) -> ${outFile}`);
