# Phase 13 — Document/KYC & Offer Letters (§29) Gap Checklist

## Gap 1: PDF generation endpoint for offer letters
**Spec**: §29.4.3 — Admin generates offer letter PDF with dynamic fields, stores in cloud
**Current**: `generateAndStoreOfferLetterPdf()` exists in pdf.service.ts but no endpoint calls it
**Fix**: Add POST `/offer-letters/:id/generate-pdf` endpoint; call pdf.service, store URL + hash in OfferLetter record; return download URL
**Status**: [ ] Not started

## Gap 2: Batch document verification endpoint
**Spec**: §29.5.3 — Admin can batch-verify or batch-reject multiple pending documents
**Current**: Frontend loops individual PATCH calls; no batch endpoint
**Fix**: Add POST `/documents/batch-verify` and POST `/documents/batch-reject` endpoints accepting array of IDs
**Status**: [ ] Not started

## Gap 3: KYC completion status calculation
**Spec**: §29.8 — KYC status column on employees page showing "Complete/Incomplete (X/Y)/Not Started"
**Current**: Employee kycStatus is referenced but never populated from DB
**Fix**: Add `getKycStatus(userId)` service that counts verified required docs vs total required; expose via user enrichment or dedicated endpoint
**Status**: [ ] Not started

## Gap 4: Document type management API
**Spec**: §29.1 — Admin can add/edit/deactivate document types without code changes
**Current**: DocumentType model exists but no CRUD endpoints
**Fix**: Add admin endpoints: POST/PATCH/DELETE `/document-types` for managing document types
**Status**: [ ] Not started

## Gap 5: Offer letter PDF download in frontend
**Spec**: §29.4.3 step 5 — Generated PDF downloadable by Admin; also accessible to employee from My Documents
**Current**: Offer letter view modal doesn't show generated PDF or download button
**Fix**: Add "Generate PDF" button on offer letter list; after generation, show download link; also expose employee's generated offer letter via My Documents
**Status**: [ ] Not started
