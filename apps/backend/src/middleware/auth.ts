import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth.config';
import { AppError } from './errorHandler';
import { fromNodeHeaders } from 'better-auth/node';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
      };
      session?: {
        id: string;
        userId: string;
        expiresAt: Date;
      };
      userId?: string; // Add explicit userId for convenience
    }
  }
}

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get session from Better-Auth
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    
    if (!session || !session.user) {
      throw new AppError(req.t ? req.t('auth.notAuthenticated') : 'Not authenticated', 401);
    }

    // Attach user and session to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
    
    req.session = {
      id: session.session.id,
      userId: session.user.id,
      expiresAt: new Date(session.session.expiresAt),
    };

    // Explicitly set userId for backward compatibility with routes
    req.userId = session.user.id;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(req.t ? req.t('auth.invalidToken') : 'Invalid or expired session', 401));
    }
  }
};
