// ──────────────────────────────────────────────
//  One-time backfill: prepend "+91" to existing
//  mobile/contact rows that lack a country code.
//
//  Tables/columns affected:
//    - User.mobile_number
//    - CandidateReport.contact_no
//    - LeaveRequest.emergency_contact
//
//  Rules:
//   - Skip rows where the value already starts with "+"
//     (already in E.164 form)
//   - Skip null/empty values
//   - Strip whitespace, dashes, parentheses, then prepend "+91"
//
//  Safety:
//   - Defaults to DRY RUN. Prints what *would* change.
//   - Pass `--apply` to actually update rows.
//
//  Usage:
//    npx tsx backend/scripts/backfill-phone-e164.ts
//    npx tsx backend/scripts/backfill-phone-e164.ts --apply
// ──────────────────────────────────────────────

import { getPrisma } from "../src/config/database.js";

const prisma = getPrisma();
const APPLY = process.argv.includes("--apply");
const DEFAULT_PREFIX = "+91";

function normalize(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) return null; // already E.164
  // Strip everything except digits
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return `${DEFAULT_PREFIX}${digits}`;
}

async function backfillUsers() {
  const users = await prisma.user.findMany({
    where: { mobileNumber: { not: null } },
    select: { id: true, mobileNumber: true },
  });
  let updated = 0;
  for (const u of users) {
    if (!u.mobileNumber) continue;
    const next = normalize(u.mobileNumber);
    if (!next) continue;
    if (APPLY) {
      await prisma.user.update({
        where: { id: u.id },
        data: { mobileNumber: next },
      });
    }
    updated++;
    console.log(`  user ${u.id}: ${u.mobileNumber} → ${next}`);
  }
  console.log(`User.mobile_number: ${updated} rows ${APPLY ? "updated" : "would update"}`);
}

async function backfillCandidates() {
  const candidates = await prisma.candidateReport.findMany({
    where: { contactNo: { not: null } },
    select: { id: true, contactNo: true },
  });
  let updated = 0;
  for (const c of candidates) {
    if (!c.contactNo) continue;
    const next = normalize(c.contactNo);
    if (!next) continue;
    if (APPLY) {
      await prisma.candidateReport.update({
        where: { id: c.id },
        data: { contactNo: next },
      });
    }
    updated++;
    console.log(`  candidate ${c.id}: ${c.contactNo} → ${next}`);
  }
  console.log(
    `CandidateReport.contact_no: ${updated} rows ${APPLY ? "updated" : "would update"}`,
  );
}

async function backfillLeaves() {
  const leaves = await prisma.leaveRequest.findMany({
    where: { emergencyContact: { not: null } },
    select: { id: true, emergencyContact: true },
  });
  let updated = 0;
  for (const l of leaves) {
    if (!l.emergencyContact) continue;
    const next = normalize(l.emergencyContact);
    if (!next) continue;
    if (APPLY) {
      await prisma.leaveRequest.update({
        where: { id: l.id },
        data: { emergencyContact: next },
      });
    }
    updated++;
    console.log(`  leave ${l.id}: ${l.emergencyContact} → ${next}`);
  }
  console.log(
    `LeaveRequest.emergency_contact: ${updated} rows ${APPLY ? "updated" : "would update"}`,
  );
}

async function main() {
  console.log(
    APPLY
      ? "APPLY MODE — rows will be updated."
      : "DRY RUN — no rows will be updated. Pass --apply to commit.",
  );
  console.log("");
  await backfillUsers();
  await backfillCandidates();
  await backfillLeaves();
  console.log("");
  console.log(APPLY ? "Done." : "Dry run complete. Re-run with --apply to commit changes.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
