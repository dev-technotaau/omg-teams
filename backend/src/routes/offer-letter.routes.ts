import { Router } from "express";
import {
  handleListOfferLetters,
  handleGetOfferLetter,
  handleCreateOfferLetter,
  handleUpdateOfferLetter,
  handleArchiveOfferLetter,
  handleGeneratePdf,
  handlePreviewPdf,
} from "../controllers/offer-letter.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get("/", handleListOfferLetters);
router.get("/:id", handleGetOfferLetter);
router.post("/", handleCreateOfferLetter);
router.patch("/:id", handleUpdateOfferLetter);
router.patch("/:id/archive", handleArchiveOfferLetter);
router.get("/:id/preview", handlePreviewPdf);
router.post("/:id/generate-pdf", handleGeneratePdf);

export { router as offerLetterRouter };
