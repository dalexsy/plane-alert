/** Console logger replacing firebase-functions/v2 logger (Pi-only runtime). */

type Fields = Record<string, unknown> | unknown;

function format(args: unknown[]): unknown[] {
  return args;
}

export const logger = {
  info(...args: unknown[]): void {
    console.log(...format(args));
  },
  warn(...args: unknown[]): void {
    console.warn(...format(args));
  },
  error(...args: unknown[]): void {
    console.error(...format(args));
  },
  debug(...args: unknown[]): void {
    console.debug(...format(args));
  },
  write(entry: { severity?: string; message?: string } & Fields): void {
    const sev = String(entry.severity || "INFO").toUpperCase();
    const msg = entry.message ?? entry;
    if (sev === "ERROR") console.error(msg);
    else if (sev === "WARNING" || sev === "WARN") console.warn(msg);
    else console.log(msg);
  },
};
