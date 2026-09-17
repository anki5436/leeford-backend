import type { Request } from "express";

export interface SafeAdmin {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  admin?: SafeAdmin;
  sessionToken?: string;
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}
