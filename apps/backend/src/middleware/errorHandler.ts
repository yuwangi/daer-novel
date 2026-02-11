import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.error(`AppError: ${err.message}`, { stack: err.stack });
    return res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
  }

  // Unexpected errors
  logger.error(`Unexpected Error: ${err.message}`, { stack: err.stack });
  
  // Use i18n for server error message if available, otherwise fallback to English/hardcoded
  const errorMessage = req.t ? req.t('auth.serverError') : 'Internal server error';
  
  return res.status(500).json({
    error: errorMessage,
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};
