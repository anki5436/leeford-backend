import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AuthController } from "../src/controllers/auth.controller.js";
import { createAuthFixture, testEnv } from "./helpers/auth-fixture.js";
import type { Express } from "express";

let app: Express;
let loginCredential: { username: string; password: string };

describe("authentication HTTP API", () => {
  before(async () => {
    const fixture = await createAuthFixture();
    loginCredential = fixture.credential;
    app = createApp({
      env: testEnv,
      sessions: fixture.sessions,
      authController: new AuthController(fixture.auth, testEnv),
    });
  });

  it("requires authentication for the dashboard API", async () => {
    const response = await request(app).get("/api/admin/dashboard");
    assert.equal(response.status, 401);
  });

  it("rejects state-changing requests without CSRF validation", async () => {
    const response = await request(app).post("/api/auth/login").send({ login: loginCredential.username, password: loginCredential.password });
    assert.equal(response.status, 403);
  });

  it("creates a secure HttpOnly session cookie and permits a protected request", async () => {
    const agent = request.agent(app);
    const csrf = await agent.get("/api/auth/csrf-token");
    const login = await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrf.body.data.csrfToken)
      .send({ login: loginCredential.username, password: loginCredential.password, rememberMe: false });
    assert.equal(login.status, 200);
    assert.match(login.headers["set-cookie"][0], /HttpOnly/);
    assert.equal("password_hash" in login.body.data.admin, false);
    assert.equal((await agent.get("/api/admin/dashboard")).status, 200);
  });

  it("logout invalidates the current session", async () => {
    const agent = request.agent(app);
    const csrf = await agent.get("/api/auth/csrf-token");
    await agent.post("/api/auth/login").set("X-CSRF-Token", csrf.body.data.csrfToken).send({ login: loginCredential.username, password: loginCredential.password });
    const freshCsrf = await agent.get("/api/auth/csrf-token");
    const logout = await agent.post("/api/auth/logout").set("X-CSRF-Token", freshCsrf.body.data.csrfToken).send({});
    assert.equal(logout.status, 200);
    assert.equal((await agent.get("/api/admin/dashboard")).status, 401);
  });
});
