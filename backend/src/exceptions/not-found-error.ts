import { AppError } from "./app-error.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";

export class NotFoundError extends AppError {
  constructor(resource = "Resource", id?: string) {
    const message = id ? `${resource} with id "${id}" not found` : `${resource} not found`;
    super(message, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
}
