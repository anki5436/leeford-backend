export const securityConfig = {
  sessionCookieName: "leeford_admin_session",
  csrfCookieName: "leeford_csrf",
  loginMaxAttempts: 5,
  loginLockMinutes: 15,
  standardSessionHours: 8,
  rememberedSessionDays: 30,
  passwordResetMinutes: 45,
} as const;
