import { AppError } from "./app-error.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";

export class ValidationError extends AppError {
  constructor(details: { path: string; message: string }[], message = "Validation failed") {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, { details });
  }
}
