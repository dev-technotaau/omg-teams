import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import {
  handleChangePassword,
  handleRequestEmailChange,
  handleVerifyEmailChange,
  handleUpdateMobile,
} from "../controllers/account.controller.js";
import {
  handleLogin,
  handleLogout,
  handleRefresh,
  handleMe,
  handleUpdateProfile,
  handleVerifyPassword,
} from "../controllers/auth.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  Auth Routes — /api/v1/auth
// ──────────────────────────────────────────────

const router = Router();

// §16, §24.9 — Login-specific rate limiting (stricter than global)
const loginLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

router.post("/login", loginLimiter, handleLogin);
router.post("/logout", requireAuth, handleLogout);
router.post("/refresh", handleRefresh);
router.get("/me", requireAuth, handleMe);
router.patch("/me/profile", requireAuth, handleUpdateProfile);
router.post("/verify-password", requireAuth, handleVerifyPassword);

// Account management (admin self-service only)
// Rate-limit sensitive actions to prevent brute-force/abuse
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

router.post("/me/change-password", requireAuth, requireAdmin, accountLimiter, handleChangePassword);
router.post(
  "/me/request-email-change",
  requireAuth,
  requireAdmin,
  accountLimiter,
  handleRequestEmailChange,
);
router.post(
  "/me/verify-email-change",
  requireAuth,
  requireAdmin,
  accountLimiter,
  handleVerifyEmailChange,
);
router.patch("/me/mobile", requireAuth, requireAdmin, accountLimiter, handleUpdateMobile);

export { router as authRouter };
