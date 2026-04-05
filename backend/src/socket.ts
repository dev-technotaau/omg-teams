import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { Server, type ServerOptions as SocketServerOptions } from "socket.io";
import { env } from "./config/env.js";
import { registerService } from "./config/service-init.js";
import { serviceStatus, ServiceState } from "./config/service-status.js";
import { logger } from "./instrument.js";
import { getSession } from "./services/session.service.js";
import type http from "node:http";

// ──────────────────────────────────────────────
//  Socket.IO Server — §24.10
//
//  JWT-authenticated, Redis-adapted for clustering,
//  role-based rooms for targeted event delivery.
// ──────────────────────────────────────────────

let io: Server | undefined;

export function initializeSocket(server: http.Server): Server {
  const corsOrigin =
    env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim());

  const opts: Partial<SocketServerOptions> = {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
  };

  io = new Server(server, opts);

  // §24.10 — Redis adapter for multi-instance broadcasting
  if (env.hasRedis) {
    void (async () => {
      try {
        const { getRedisClient, getRedisSubscriber } = await import("./config/redis.js");
        const pubClient = getRedisClient();
        const subClient = getRedisSubscriber();
        io.adapter(createAdapter(pubClient, subClient));
        logger.info("Socket.IO Redis adapter attached");
      } catch (err) {
        logger.warn("Socket.IO Redis adapter failed — running single-instance", {
          error: (err as Error).message,
        });
      }
    })();
  }

  // §24.10 — JWT/cookie authentication on connection
  io.use(async (socket, next) => {
    try {
      // Parse cookies from handshake headers
      const rawCookie = socket.handshake.headers.cookie ?? "";
      const cookieMap = new Map(
        rawCookie.split(";").map((c) => {
          const [k, ...v] = c.trim().split("=");
          return [k ?? "", v.join("=")] as [string, string];
        }),
      );
      const token =
        cookieMap.get("omg_access") ?? (socket.handshake.auth as { token?: string }).token;

      if (!token) {
        next();
        return;
      }

      const payload = jwt.verify(token, env.JWT_SECRET) as {
        sub?: string;
        sessionId?: string;
      };
      if (!payload?.sub || !payload?.sessionId) {
        next();
        return;
      }

      const session = await getSession(payload.sessionId);
      if (!session) {
        next();
        return;
      }

      // Attach auth data to socket
      const sd = socket.data as { userId?: string; role?: string; sessionId?: string };
      sd.userId = session.userId;
      sd.role = session.role;
      sd.sessionId = session.sessionId;

      next();
    } catch {
      next();
    }
  });

  // ── Connection handler ──
  io.on("connection", (socket) => {
    const data = socket.data as { userId?: string; role?: string; sessionId?: string };

    // Auto-join rooms if authenticated via middleware
    if (data.userId) {
      void socket.join(`user:${data.userId}`);
      logger.debug("Socket auto-joined user room", { id: socket.id, userId: data.userId });
    }
    if (data.role) {
      void socket.join(`role:${data.role}`);
      logger.debug("Socket auto-joined role room", { id: socket.id, role: data.role });
    }

    // Fallback: client can request room join (for reconnections with new auth)
    socket.on("auth:join", (authData: { userId: string; role: string }) => {
      if (authData.userId && !data.userId) {
        void socket.join(`user:${authData.userId}`);
      }
      if (authData.role && !data.role) {
        void socket.join(`role:${authData.role}`);
      }
    });

    socket.on("disconnect", (reason) => {
      logger.debug("Socket disconnected", { id: socket.id, reason });
    });

    socket.on("error", (err) => {
      logger.error("Socket error", { id: socket.id, error: err.message });
    });
  });

  serviceStatus.set("socketio", ServiceState.CONNECTED);
  logger.info("Socket.IO initialized");
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO not initialized — call initializeSocket() first");
  }
  return io;
}

// ──────────────────────────────────────────────
//  §24.10 — Helper to emit events to specific targets
// ──────────────────────────────────────────────

/** Emit to a specific user's room */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  try {
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch {
    // Socket not initialized — non-critical
  }
}

/** Emit to all users with a specific role */
export function emitToRole(role: string, event: string, payload: unknown): void {
  try {
    getIO().to(`role:${role}`).emit(event, payload);
  } catch {
    // Socket not initialized — non-critical
  }
}

/** §24.10 — Emit report:submitted to Admin + assigned RMs */
export function emitReportSubmitted(recruiterName: string, count: number): void {
  const payload = { recruiterName, count, timestamp: new Date().toISOString() };
  emitToRole("ADMIN", "report:submitted", payload);
  emitToRole("REPORTING_MANAGER", "report:submitted", payload);
}

/** §24.10 — Emit report:statusChanged */
export function emitReportStatusChanged(
  recordId: string,
  oldStatus: string,
  newStatus: string,
): void {
  const payload = { recordId, oldStatus, newStatus, timestamp: new Date().toISOString() };
  emitToRole("ADMIN", "report:statusChanged", payload);
  emitToRole("REPORTING_MANAGER", "report:statusChanged", payload);
}

/** §24.10 — Emit session:revoked to force client logout */
export function emitSessionRevoked(userId: string): void {
  emitToUser(userId, "session:revoked", { userId, timestamp: new Date().toISOString() });
}

/** §24.10 — Emit user:suspended to force client logout */
export function emitUserSuspended(userId: string): void {
  emitToUser(userId, "user:suspended", { userId, timestamp: new Date().toISOString() });
}

/** §24.10 — Emit device:reset to force client logout */
export function emitDeviceReset(userId: string): void {
  emitToUser(userId, "device:reset", { userId, timestamp: new Date().toISOString() });
}

/** §24.10 — Emit analytics:update for live dashboard counters */
export function emitAnalyticsUpdate(data: Record<string, unknown>): void {
  emitToRole("ADMIN", "analytics:update", data);
}

// ──────────────────────────────────────────────
//  Service Registration
//
//  Socket.IO requires the HTTP server so it can't
//  use the standard connect() lifecycle. We register
//  it as a manually-managed service and update its
//  state when initializeSocket() is called above.
// ──────────────────────────────────────────────

registerService({
  name: "socketio",
  critical: false,
  // connect is a no-op — real init happens in server.ts via initializeSocket()
  connect: () => {
    // State is set to CONNECTED inside initializeSocket()
    // If we get here and io is already set, it's already connected
    if (io) return;
    // Otherwise, mark as pending — server.ts will call initializeSocket() later
  },
  disconnect: async () => {
    if (io) {
      await io.close();
      io = undefined;
      logger.info("Socket.IO server closed");
    }
  },
});
