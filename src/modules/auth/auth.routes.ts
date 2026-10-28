import { Router, type Request, type Response, type NextFunction } from 'express';
import { getCurrentUser, login, logout } from './auth.service.js';

export const authRouter = Router();

const COOKIE_NAME = 'reservet_session';
const EIGHT_HOURS_SECONDS = 8 * 60 * 60;

function getToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  const token = cookie?.slice(COOKIE_NAME.length + 1);

  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.APP_ENV === 'pro',
    path: '/',
    maxAge: EIGHT_HOURS_SECONDS * 1000,
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getToken(req);

  if (!token) {
    res.status(401).json({ error: 'Debes iniciar sesión.' });
    return;
  }

  void getCurrentUser(token)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: 'Debes iniciar sesión.' });
        return;
      }

      res.locals.user = user;
      res.locals.sessionToken = token;
      next();
    })
    .catch(next);
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password
    ) {
      res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
      return;
    }

    const result = await login(username, password);

    if (!result) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      return;
    }

    res.cookie(COOKIE_NAME, result.token, cookieOptions());
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ user: res.locals.user });
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = getToken(req);

    if (token) {
      await logout(token);
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.APP_ENV === 'pro',
      path: '/',
    });

    res.status(200).json({ message: 'Sesión cerrada.' });
  } catch (error) {
    next(error);
  }
});

export { getToken };
