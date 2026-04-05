import passport from "passport";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  type StrategyOptionsWithoutRequest,
} from "passport-jwt";
import { getPrisma } from "./database.js";
import { env } from "./env.js";
import { logger } from "../instrument.js";

// ──────────────────────────────────────────────
//  Passport Configuration (JWT)
//
//  Note: The app uses custom requireAuth middleware
//  (cookie-based JWT + Redis session) for all routes.
//  Passport JWT is configured as a secondary option
//  for any code that calls passport.authenticate("jwt").
// ──────────────────────────────────────────────

export function configurePassport(): void {
  if (!env.hasJwtSecret) {
    logger.warn("JWT_SECRET not set — Passport JWT strategy disabled");
    return;
  }

  const jwtOptions: StrategyOptionsWithoutRequest = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: env.JWT_SECRET,
  };

  passport.use(
    "jwt",
    new JwtStrategy(jwtOptions, (payload: { sub?: string }, done) => {
      if (!payload.sub) {
        done(null, false);
        return;
      }

      void getPrisma()
        .user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, status: true },
        })
        .then((user) => {
          if (user?.status !== "ACTIVE") {
            done(null, false);
            return;
          }
          done(null, { id: user.id, role: user.role });
        })
        .catch((err: unknown) => done(err, false));
    }),
  );

  logger.info("Passport JWT strategy configured");
}

export { passport };
