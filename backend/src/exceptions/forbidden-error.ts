import { AppError } from "./app-error.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
}
