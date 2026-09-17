import { Router } from "express";
import { createRequireAuth, requireRole } from "../middleware/auth.middleware.js";
import { SessionService } from "../services/session.service.js";
import type { AuthenticatedRequest } from "../types/auth.js";

export function createAdminRouter(sessions: SessionService): Router {
  const router = Router();
  router.use(createRequireAuth(sessions));
  router.get("/dashboard", (request: AuthenticatedRequest, response) => {
    response.set("Cache-Control", "no-store").status(200).json({
      success: true,
      data: {
        admin: request.admin,
        summary: { totalUsers: 0, activeUsers: 0, recentActivity: 0, systemStatus: "Operational" },
      },
    });
  });
  router.get("/super-admin-check", requireRole("SUPER_ADMIN"), (_request, response) => {
    response.status(200).json({ success: true });
  });
  return router;
}
