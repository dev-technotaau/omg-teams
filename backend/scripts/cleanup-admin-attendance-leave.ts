// ──────────────────────────────────────────────
//  One-time cleanup: remove AttendanceRecord,
//  LeaveRequest, and LeaveBalance rows that belong
//  to ADMIN users.
//
//  Admin is excluded from the attendance + leave
//  systems at the source (see punchIn / punchOut /
//  createLeaveRequest), but any rows created before
//  those guards were in place need to be removed.
//
//  Safety:
//   - Defaults to DRY RUN (no deletes). Prints
//     counts of what *would* be deleted.
//   - Pass `--apply` to actually perform the deletes.
//   - Runs inside a single transaction so either
//     everything succeeds or nothing does.
//
//  Usage:
//    npx tsx backend/scripts/cleanup-admin-attendance-leave.ts
//    npx tsx backend/scripts/cleanup-admin-attendance-leave.ts --apply
// ──────────────────────────────────────────────

import { getPrisma } from "../src/config/database.js";

const prisma = getPrisma();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will delete)" : "DRY RUN (no changes)"}`);

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (admins.length === 0) {
    console.log("No admin users found. Nothing to do.");
    return;
  }

  console.log(`\nFound ${admins.length} admin user(s):`);
  for (const a of admins) {
    console.log(`  - ${a.firstName} ${a.lastName} <${a.email}> (${a.id})`);
  }

  const adminIds = admins.map((a) => a.id);

  const [attendanceCount, leaveRequestCount, leaveBalanceCount] = await Promise.all([
    prisma.attendanceRecord.count({ where: { userId: { in: adminIds } } }),
    prisma.leaveRequest.count({ where: { userId: { in: adminIds } } }),
    prisma.leaveBalance.count({ where: { userId: { in: adminIds } } }),
  ]);

  console.log(`\nRows belonging to admin(s):`);
  console.log(`  AttendanceRecord: ${attendanceCount}`);
  console.log(`  LeaveRequest:     ${leaveRequestCount}`);
  console.log(`  LeaveBalance:     ${leaveBalanceCount}`);
  console.log(`  (LeaveBalanceHistory will cascade via LeaveBalance)`);

  if (attendanceCount + leaveRequestCount + leaveBalanceCount === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  if (!APPLY) {
    console.log(`\nDry run complete. Re-run with --apply to delete.`);
    return;
  }

  console.log(`\nDeleting...`);
  const result = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendanceRecord.deleteMany({
      where: { userId: { in: adminIds } },
    });
    const leaveRequests = await tx.leaveRequest.deleteMany({
      where: { userId: { in: adminIds } },
    });
    const leaveBalances = await tx.leaveBalance.deleteMany({
      where: { userId: { in: adminIds } },
    });
    return { attendance, leaveRequests, leaveBalances };
  });

  console.log(`\nDeleted:`);
  console.log(`  AttendanceRecord: ${result.attendance.count}`);
  console.log(`  LeaveRequest:     ${result.leaveRequests.count}`);
  console.log(`  LeaveBalance:     ${result.leaveBalances.count}`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
