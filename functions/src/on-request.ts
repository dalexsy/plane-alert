/**
 * Identity wrapper for former firebase-functions onRequest handlers.
 * Pi express binds the returned function directly.
 */
import type { Request, Response } from "express";

type Handler = (req: Request, res: Response) => void | Promise<void>;

export function onRequest(
  _options: unknown,
  handler: Handler,
): Handler {
  return handler;
}

export function onSchedule(
  _options: unknown,
  handler: () => void | Promise<void>,
): () => void | Promise<void> {
  return handler;
}
