import * as fs from 'fs';
import * as path from 'path';

export interface PlanesApiBuildInfo {
  service: string;
  version: string;
  gitSha: string;
  gitShaShort: string;
  builtAt: string;
}

const FALLBACK: PlanesApiBuildInfo = {
  service: 'planes-api',
  version: '0.0.0',
  gitSha: 'unknown',
  gitShaShort: 'unknown',
  builtAt: '',
};

export function readPlanesApiBuildInfo(
  cwd: string = process.cwd(),
): PlanesApiBuildInfo {
  const candidates = [
    path.join(cwd, 'build-info.json'),
    path.join(cwd, 'lib', 'build-info.json'),
    path.join(__dirname, 'build-info.json'),
    path.join(__dirname, '..', 'build-info.json'),
  ];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<
        PlanesApiBuildInfo
      >;
      return {
        service: 'planes-api',
        version: String(raw.version || FALLBACK.version),
        gitSha: String(raw.gitSha || FALLBACK.gitSha),
        gitShaShort: String(
          raw.gitShaShort ||
            (raw.gitSha ? String(raw.gitSha).slice(0, 12) : FALLBACK.gitShaShort),
        ),
        builtAt: String(raw.builtAt || FALLBACK.builtAt),
      };
    } catch {
      // try next
    }
  }
  return { ...FALLBACK };
}
