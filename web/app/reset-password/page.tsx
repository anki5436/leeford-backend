"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "../../components/auth-shell";
import { PasswordField } from "../../components/password-field";
import { apiRequest, ApiError } from "../../lib/api";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const matches = !confirmPassword || newPassword === confirmPassword;
  const rules = {
    length: newPassword.length >= 10,
    casing: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword),
    complexity: /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword),
  };
  const passwordValid = Object.values(rules).every(Boolean);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!token) { setError("This password reset link is missing its security token."); return; }
    if (!matches) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      const result = await apiRequest<{ message: string }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword, confirmPassword }) }, true);
      setMessage(result.message); setNewPassword(""); setConfirmPassword("");
      window.history.replaceState({}, "", "/reset-password");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to reset your password. Please try again.");
    } finally { setSubmitting(false); }
  }

  return (
    <AuthShell>
      <Link className="back-link" href="/login">← Back to sign in</Link>
      <div className="form-heading"><p className="eyebrow">SECURE RECOVERY</p><h2>Create New Password</h2><p>Choose a strong password you haven’t used for this account before.</p></div>
      {message && <div className="alert alert-success" role="status">{message} <Link href="/login">Sign in</Link></div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit} noValidate>
        <PasswordField id="newPassword" label="New Password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
        <PasswordField id="confirmPassword" label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" error={matches ? undefined : "Passwords do not match"} />
        <ul className="password-rules" aria-label="Password requirements" aria-live="polite"><li className={rules.length ? "valid" : ""}>At least 10 characters</li><li className={rules.casing ? "valid" : ""}>Uppercase and lowercase letters</li><li className={rules.complexity ? "valid" : ""}>A number and special character</li></ul>
        <button className="primary-button" type="submit" disabled={submitting || !passwordValid || !confirmPassword || !matches}>{submitting ? <span className="spinner" aria-label="Resetting" /> : "Reset Password"}</button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="page-loader">Loading secure reset…</div>}><ResetPasswordForm /></Suspense>;
}
