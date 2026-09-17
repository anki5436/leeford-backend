"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "../../components/auth-shell";
import { apiRequest, ApiError } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setError(""); setMessage("");
    try {
      const result = await apiRequest<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, true);
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to process this request. Please try again.");
    } finally { setSubmitting(false); }
  }

  return (
    <AuthShell>
      <Link className="back-link" href="/login">← Back to sign in</Link>
      <div className="form-heading">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h2>Forgot Password?</h2>
        <p>Enter your admin email address and we’ll send secure reset instructions.</p>
      </div>
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit} noValidate>
        <div className="field-group">
          <label htmlFor="email">Email Address</label>
          <input suppressHydrationWarning id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus />
        </div>
        <button className="primary-button" type="submit" disabled={submitting || !email}>{submitting ? <span className="spinner" aria-label="Sending" /> : "Send Reset Link"}</button>
      </form>
    </AuthShell>
  );
}
