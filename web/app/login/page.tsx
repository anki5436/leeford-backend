"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "../../components/auth-shell";
import { PasswordField } from "../../components/password-field";
import { apiRequest, ApiError } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest("/api/auth/me").then(() => router.replace("/admin/dashboard")).catch(() => undefined);
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: login.trim(), password, rememberMe }),
      }, true);
      router.replace("/admin/dashboard");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="form-heading">
        <p className="eyebrow">SECURE SIGN IN</p>
        <h2>Welcome Back</h2>
        <p>Sign in to access the Leeford Healthcare Admin Portal</p>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit} noValidate>
        <div className="field-group">
          <label htmlFor="login">Username or Email</label>
          <input suppressHydrationWarning id="login" name="login" value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required autoFocus />
        </div>
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="form-options">
          <label className="checkbox-label"><input suppressHydrationWarning type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>
          <Link href="/forgot-password">Forgot Password?</Link>
        </div>
        <button className="primary-button" type="submit" disabled={submitting || !login.trim() || !password}>
          {submitting ? <span className="spinner" aria-label="Signing in" /> : "Sign In"}
        </button>
      </form>
      <p className="support-copy">Need help accessing your account? <a href="mailto:support@leeford.in">Contact support</a></p>
    </AuthShell>
  );
}
