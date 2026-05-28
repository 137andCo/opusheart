import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
  startTime: number;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  const context: RequestContext = {
    requestId,
    startTime: Date.now(),
  };
  asyncLocalStorage.run(context, () => {
    req.headers['x-request-id'] = requestId;
    next();
  });
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}
