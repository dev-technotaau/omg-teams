/**
 * Re-export getPrisma from config/database for convenience.
 * Some controllers use dynamic `import("../lib/prisma.js")`.
 */
export { getPrisma } from "../config/database.js";
