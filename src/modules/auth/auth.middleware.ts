import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from './auth.service.js';
import { getToken } from './auth.routes.js';

export async function requireAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = getToken(req);

    if (!token) {
      res.status(401).json({ error: 'Debes iniciar sesión.' });
      return;
    }

    const user = await getCurrentUser(token);

    if (!user) {
      res.status(401).json({ error: 'Debes iniciar sesión.' });
      return;
    }

    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
