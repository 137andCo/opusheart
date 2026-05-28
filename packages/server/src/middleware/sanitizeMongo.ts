import type { Request, Response, NextFunction } from 'express';

/**
 * Defense-in-depth against NoSQL operator injection. Recursively strips keys
 * that begin with '$' or contain '.' from incoming request data. Legitimate API
 * clients never send such keys, and the app builds every Mongo operator
 * server-side (never from a raw request key), so this cannot interfere with
 * intended queries. The primary protection remains the per-route Zod schemas;
 * this is a belt-and-suspenders layer.
 *
 * Implemented to be Express 5 safe: it mutates objects in place rather than
 * reassigning `req.query` (a read-only getter in Express 5), which is why
 * `express-mongo-sanitize` cannot be used here.
 */
function scrub(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) scrub(item);
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      scrub(obj[key]);
    }
  }
}

export function sanitizeMongo(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) scrub(req.body);
  if (req.params) scrub(req.params);
  // req.query is a getter in Express 5; mutate the returned object in place.
  try {
    if (req.query) scrub(req.query);
  } catch {
    // If the platform exposes req.query as immutable, validated routes still
    // coerce query values to scalars via Zod.
  }
  next();
}
