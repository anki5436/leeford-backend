import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../src/services/password.service.js";
import { createAdminSchema } from "../src/validators/auth.validator.js";
import { createAuthFixture } from "./helpers/auth-fixture.js";

describe("security foundations", () => {
  it("stores passwords as Argon2id hashes and verifies them", async () => {
    const password = `S!s9${randomBytes(18).toString("base64url")}`;
    const hash = await hashPassword(password);
    assert.ok(hash.startsWith("$argon2id$"));
    assert.notEqual(hash, password);
    assert.equal(await verifyPassword(hash, password), true);
  });

  it("enforces the password policy", () => {
    assert.equal(createAdminSchema.safeParse({ username: "admin", email: "a@example.test", password: "weak", confirmPassword: "weak" }).success, false);
  });

  it("detects duplicate usernames and emails for interactive admin creation", async () => {
    const { repository, credential } = await createAuthFixture();
    assert.deepEqual(await repository.adminIdentityExists(credential.username.toUpperCase(), credential.email), { username: true, email: true });
  });

  it("uses parameter placeholders and never interpolates input into repository SQL", async () => {
    const source = await readFile(path.resolve("src/repositories/auth.repository.ts"), "utf8");
    assert.match(source, /LOWER\(au\.username\) = LOWER\(\$1\)/);
    assert.doesNotMatch(source, /\$\{(?:login|email|username|password|token)/);
  });
});
