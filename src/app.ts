import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { getPool } from "./config/database.js";
import { getEnv, type AppEnv } from "./config/env.js";
import { AuthController } from "./controllers/auth.controller.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { generalRateLimiter } from "./middleware/rate-limit.middleware.js";
import { AuthRepository } from "./repositories/auth.repository.js";
import { createAdminRouter } from "./routes/admin.routes.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { AuthService } from "./services/auth.service.js";
import { SmtpEmailService } from "./services/email.service.js";
import { SessionService } from "./services/session.service.js";

export interface AppDependencies {
  env: AppEnv;
  authController: AuthController;
  sessions: SessionService;
}

function buildDependencies(): AppDependencies {
  const env = getEnv();
  const repository = new AuthRepository(getPool());
  const sessions = new SessionService(repository, env.SESSION_SECRET);
  const email = new SmtpEmailService(env);
  const authService = new AuthService(repository, sessions, email, env.SESSION_SECRET);
  return { env, sessions, authController: new AuthController(authService, env) };
}

export function createApp(dependencies: AppDependencies = buildDependencies()): Express {
  const { env, sessions, authController } = dependencies;
  const app = express();

  if (env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
      hsts: env.NODE_ENV === "production" ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(generalRateLimiter);

  app.get("/api/v1/health", (_request, response) => {
    response.status(200).json({ success: true, message: "Leeford API is running" });
  });
  app.use("/api/auth", createAuthRouter(authController, sessions, env));
  app.use("/api/admin", createAdminRouter(sessions));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
