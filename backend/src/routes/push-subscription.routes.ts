import { Router } from "express";
import {
  handleRegisterToken,
  handleUnregisterToken,
} from "../controllers/push-subscription.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/", handleRegisterToken);
router.delete("/", handleUnregisterToken);

export { router as pushSubscriptionRouter };
