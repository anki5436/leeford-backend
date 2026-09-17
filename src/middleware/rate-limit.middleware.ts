import rateLimit from "express-rate-limit";

const common = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
  },
};

export const generalRateLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 300 });
export const loginRateLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});
export const forgotPasswordRateLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 5 });
export const resetPasswordRateLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 10 });
