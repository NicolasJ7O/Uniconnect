export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'AppError';

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ModerationError extends AppError {
  public readonly moderationCode: string;

  constructor(moderationCode: string, message: string) {
    super(400, message);
    this.name = 'ModerationError';
    this.moderationCode = moderationCode;
    Object.setPrototypeOf(this, ModerationError.prototype);
  }
}

