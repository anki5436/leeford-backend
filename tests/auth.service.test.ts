import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { before, describe, it } from "node:test";
import { verifyPassword } from "../src/services/password.service.js";
import { hashToken } from "../src/utils/crypto.js";
import { createAuthFixture, testEnv, type MemoryRepository, type MemoryEmailService } from "./helpers/auth-fixture.js";
import type { AuthService } from "../src/services/auth.service.js";
import type { SessionService } from "../src/services/session.service.js";

const context = { ipAddress: "127.0.0.1", userAgent: "test" };
let auth: AuthService;
let sessions: SessionService;
let repository: MemoryRepository;
let email: MemoryEmailService;
let credential: { username: string; email: string; password: string };

describe("authentication service", () => {
  before(async () => ({ auth, sessions, repository, email, credential } = await createAuthFixture()));

  it("logs in with a username and returns only safe admin fields", async () => {
    const result = await auth.login(credential.username, credential.password, false, context);
    assert.equal(result.admin.username, credential.username);
    assert.equal("password_hash" in result.admin, false);
    assert.ok(await sessions.authenticate(result.token));
  });

  it("logs in with an email case-insensitively", async () => {
    const result = await auth.login(credential.email.toUpperCase(), credential.password, false, context);
    assert.equal(result.admin.email, credential.email);
  });

  it("rejects an incorrect password with a generic error and tracks the attempt", async () => {
    const beforeAttempts = repository.admins[0].failed_login_attempts;
    await assert.rejects(auth.login(credential.username, `${credential.password}wrong`, false, context), /Invalid username\/email or password/);
    assert.equal(repository.admins[0].failed_login_attempts, beforeAttempts + 1);
  });

  it("rejects an unknown account with the same generic error", async () => {
    await assert.rejects(auth.login("nobody@example.test", `${credential.password}wrong`, false, context), /Invalid username\/email or password/);
  });

  it("rejects inactive administrators", async () => {
    await assert.rejects(auth.login(repository.admins[1].username, credential.password, false, context), /Invalid username\/email or password/);
  });

  it("temporarily locks an account on the fifth failed attempt", async () => {
    repository.admins[0].failed_login_attempts = 4;
    await assert.rejects(auth.login(credential.username, `${credential.password}wrong`, false, context));
    assert.ok(repository.admins[0].locked_until && repository.admins[0].locked_until > new Date());
    repository.admins[0].failed_login_attempts = 0;
    repository.admins[0].locked_until = null;
  });

  it("prevents login while a temporary lock is active", async () => {
    repository.admins[0].locked_until = new Date(Date.now() + 60_000);
    await assert.rejects(auth.login(credential.username, credential.password, false, context));
    repository.admins[0].locked_until = null;
  });

  it("logout revokes the authenticated session", async () => {
    const result = await auth.login(credential.username, credential.password, false, context);
    await auth.logout(result.token, context);
    assert.equal(await sessions.authenticate(result.token), null);
  });

  it("forgot password is enumeration-safe", async () => {
    const known = await auth.requestPasswordReset(credential.email, context);
    const unknown = await auth.requestPasswordReset("unknown@example.test", context);
    assert.equal(known, unknown);
    assert.equal(email.messages.length, 1);
  });

  it("expired reset tokens are rejected", async () => {
    await auth.requestPasswordReset(credential.email, context);
    const sent = email.messages.at(-1)!;
    const stored = repository.resets.find((entry) => entry.tokenHash === hashToken(sent.token, testEnv.SESSION_SECRET))!;
    stored.expiresAt = new Date(Date.now() - 1);
    await assert.rejects(auth.resetPassword(sent.token, `A!a9${randomBytes(18).toString("base64url")}`, context), /invalid or has expired/);
  });

  it("successful reset changes the Argon2 password and invalidates prior sessions", async () => {
    const login = await auth.login(credential.username, credential.password, false, context);
    await auth.requestPasswordReset(credential.email, context);
    const sent = email.messages.at(-1)!;
    const newPassword = `N!n9${randomBytes(18).toString("base64url")}`;
    await auth.resetPassword(sent.token, newPassword, context);
    assert.ok(repository.admins[0].password_hash.startsWith("$argon2id$"));
    assert.ok(await verifyPassword(repository.admins[0].password_hash, newPassword));
    assert.equal(await sessions.authenticate(login.token), null);
  });

  it("reset tokens cannot be reused", async () => {
    const sent = email.messages.at(-1)!;
    await assert.rejects(auth.resetPassword(sent.token, `A!a9${randomBytes(18).toString("base64url")}`, context), /invalid or has expired/);
  });

  it("SQL injection-shaped login input does not authenticate", async () => {
    await assert.rejects(auth.login("' OR 1=1 --", credential.password, false, context));
  });
});
