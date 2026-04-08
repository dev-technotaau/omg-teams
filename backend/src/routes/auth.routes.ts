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

// §16, §24.9 — Login-specific rate limiting (stricter than global).
// Keyed PER-IP across all identifiers/roles so an attacker on one IP cannot
// fan out across hundreds of Employee IDs to enumerate or brute-force. We
// rely on `app.set("trust proxy", 1)` for the correct client IP behind the
// reverse proxy. Counts every login attempt — success OR failure — to cap
// total request volume regardless of outcome.
const loginLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  // Explicit IP-only keying — do NOT mix in identifier/role here, otherwise
  // the limit becomes per-account and an attacker can bypass it by rotating
  // the identifier in each request. The default `ipKeyGenerator` handles
  // IPv6 prefix collapsing correctly.
  keyGenerator: (req) => req.ip ?? "unknown",
  skipSuccessfulRequests: false,
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
