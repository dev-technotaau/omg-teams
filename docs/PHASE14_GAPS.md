# Phase 14 — Profile Page & Photo (§30) Gap Checklist

## Gap 1: Profile page missing info sections
**Spec**: §30.1.1 — KYC status summary, attendance summary, leave balance, security info
**Current**: Profile page shows personal info + editable fields + photo, but missing KYC/attendance/leave/security sections
**Fix**: Add 4 compact info cards below editable fields: KYC progress, current month attendance summary, leave balance, last login + device status
**Status**: [ ] Not started

## Gap 2: Cloudinary cleanup on photo change/delete
**Spec**: §30.3 — When photo changed, old image must be deleted from Cloudinary; orphaned image prevention
**Current**: New photo uploaded but old image NOT deleted from Cloudinary, causing orphans
**Fix**: In upload controller, before saving new URL, fetch old storageKey and delete from Cloudinary; add cleanup on delete endpoint
**Status**: [ ] Not started

## Gap 3: Confirmation dialog for photo removal/replacement
**Spec**: §30.4 — Custom confirmation dialogs for remove photo and replace photo actions
**Current**: Photo removal calls handler directly with no confirmation; no replace confirmation
**Fix**: Wire ConfirmDialog component before remove/replace photo actions on profile page
**Status**: [ ] Not started

## Gap 4: Admin photo management endpoints
**Spec**: §30.5 — Admin can upload/change/remove photo for any user
**Current**: Only self-upload endpoints exist (POST/DELETE /uploads/profile-photo)
**Fix**: Add admin endpoints: POST /uploads/profile-photo/:userId, DELETE /uploads/profile-photo/:userId with admin auth
**Status**: [ ] Not started

## Gap 5: Image editor reset button
**Spec**: §30.2.3 — Reset button to undo all manipulations and return to original state
**Current**: Crop modal has save/cancel but no reset
**Fix**: Add "Reset" button to profile-photo-crop.tsx that resets crop, zoom, rotation, flip to defaults
**Status**: [ ] Not started
