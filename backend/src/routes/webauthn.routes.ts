import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  handleRegisterOptions,
  handleRegister,
  handleAuthenticateOptions,
  handleAuthenticate,
  handleLoginOptions,
  handleLoginVerify,
  handleListCredentials,
  handleRenameCredential,
  handleDeleteCredential,
} from "../controllers/webauthn.controller.js";
import { requireAuth } from "../middleware/auth.js";

// ──────────────────────────────────────────────
//  WebAuthn Routes — /api/v1/webauthn
// ──────────────────────────────────────────────

const router = Router();

// Rate limiter for login attempts (same as password login)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many passkey login attempts. Please try again later." },
});

// ── Passwordless login (no auth required) ──
router.post("/login-options", loginLimiter, handleLoginOptions);
router.post("/login", loginLimiter, handleLoginVerify);

// ── All routes below require authentication ──
router.use(requireAuth);

// Registration flow (logged-in user adds a passkey)
router.get("/register-options", handleRegisterOptions);
router.post("/register", handleRegister);

// Step-up re-authentication (logged-in user verifies identity with passkey)
router.get("/authenticate-options", handleAuthenticateOptions);
router.post("/authenticate", handleAuthenticate);

// Credential management
router.get("/credentials", handleListCredentials);
router.patch("/credentials/:id", handleRenameCredential);
router.delete("/credentials/:id", handleDeleteCredential);

export { router as webauthnRouter };
