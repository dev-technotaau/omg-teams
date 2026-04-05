import { AppError } from "./app-error.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";

export class UnauthorizedError extends AppError {
  constructor(
    message = "Authentication required",
    code: ErrorCode = ErrorCode.INVALID_CREDENTIALS,
  ) {
    super(message, HttpStatus.UNAUTHORIZED, code);
  }
}
