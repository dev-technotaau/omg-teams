import { type ErrorCode } from "../constants/error-codes.js";
import { type HttpStatusCode } from "../constants/http-status.js";

/**
 * Base application error. All custom errors extend this.
 * Express error handler catches these and formats the response.
 */
export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: { path: string; message: string }[] | undefined;

  constructor(
    message: string,
    statusCode: HttpStatusCode,
    code: ErrorCode,
    options?: {
      isOperational?: boolean;
      details?: { path: string; message: string }[];
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options?.isOperational ?? true;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
