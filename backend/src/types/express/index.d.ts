import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      role: Role;
      sessionId: string;
      deviceId: string;
    }
  }
}
