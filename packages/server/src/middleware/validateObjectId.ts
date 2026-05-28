import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * Middleware that validates all :id-style route params are valid MongoDB ObjectIds.
 * Returns 400 if any param ending in 'id' or 'Id' is not a valid ObjectId.
 */
export function validateObjectId(req: Request, res: Response, next: NextFunction): void {
  for (const [key, value] of Object.entries(req.params)) {
    if (/[iI]d$/.test(key) || key === 'id') {
      if (typeof value === 'string' && !mongoose.isValidObjectId(value)) {
        res.status(400).json({
          error: { message: `Invalid ${key} format`, code: 'INVALID_ID' },
        });
        return;
      }
    }
  }
  next();
}
