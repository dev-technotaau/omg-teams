// ──────────────────────────────────────────────
//  One-shot: sync dropdown_options to the full India dataset
//
//  After `prisma db push` adds the new `zone` and `parent_id` columns to
//  dropdown_options, run this script once to:
//
//   1. Insert/update all 28 states + 8 union territories with their zones
//   2. Insert/update major cities for each state, linked via parent_id
//   3. Insert/update the universal profile list (no zone)
//   4. Insert/update qualifications, notice periods, diploma types
//   5. Wipe legacy SET_A/SET_B tags off any existing profile rows
//
//  Backed by the same `seedDropdownOptions()` helper the seed file uses,
//  so there is exactly one source of truth for what the canonical dataset
//  looks like. Idempotent — safe to run repeatedly.
//
//  Usage:
//    npx tsx scripts/backfill-dropdown-zones.ts
// ──────────────────────────────────────────────

import { getPrisma } from "../src/config/database.js";
import { seedDropdownOptions } from "../prisma/seeds/dropdown-data.js";

const prisma = getPrisma();

async function main() {
  console.log("── Syncing dropdown_options to canonical India dataset ──\n");

  const report = await seedDropdownOptions(prisma);

  console.log(`  States:         ${report.statesUpserted} upserted`);
  console.log(
    `  Locations:      ${report.locationsUpserted} upserted` +
      (report.locationsSkipped > 0 ? ` (${report.locationsSkipped} skipped — parent state missing)` : ""),
  );
  console.log(`  Profiles:       ${report.profilesUpserted} upserted`);
  if (report.profilesZoneSetCleared > 0) {
    console.log(`                  ${report.profilesZoneSetCleared} cleared of legacy zone_set tags`);
  }
  console.log(`  Qualifications: ${report.qualificationsUpserted} upserted`);
  console.log(`  Notice Periods: ${report.noticePeriodsUpserted} upserted`);
  console.log(`  Diploma Types:  ${report.diplomaTypesUpserted} upserted`);
  console.log("\n✓ Dropdown options synced.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
