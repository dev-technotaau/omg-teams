/**
 * §24.4 — Unit Tests: Error handling classes
 *
 * Tests for custom error class hierarchy.
 */

import { AppError } from "../exceptions/app-error.js";
import { ValidationError } from "../exceptions/validation-error.js";
import { NotFoundError } from "../exceptions/not-found-error.js";
import { UnauthorizedError } from "../exceptions/unauthorized-error.js";
import { ForbiddenError } from "../exceptions/forbidden-error.js";
import { RateLimitError } from "../exceptions/rate-limit-error.js";

describe("Custom error classes", () => {
  it("AppError should set correct properties", () => {
    const err = new AppError("Test error", 400, "TEST_CODE");
    expect(err.message).toBe("Test error");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("TEST_CODE");
    expect(err.isOperational).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it("ValidationError should be 400 with VALIDATION_ERROR code", () => {
    const err = new ValidationError("Field is required");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("NotFoundError should be 404", () => {
    const err = new NotFoundError("User", "abc123");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toContain("User");
  });

  it("UnauthorizedError should be 401", () => {
    const err = new UnauthorizedError("Invalid token");
    expect(err.statusCode).toBe(401);
  });

  it("ForbiddenError should be 403", () => {
    const err = new ForbiddenError("Not allowed");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("RateLimitError should be 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
