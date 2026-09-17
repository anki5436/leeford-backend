import nodemailer, { type Transporter } from "nodemailer";
import type { AppEnv } from "../config/env.js";

export interface EmailService {
  sendPasswordReset(email: string, rawToken: string): Promise<void>;
}

export class SmtpEmailService implements EmailService {
  private readonly transporter: Transporter | null;

  constructor(private readonly env: AppEnv) {
    this.transporter = env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth:
            env.SMTP_USER && env.SMTP_PASSWORD
              ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
              : undefined,
        })
      : null;
  }

  async sendPasswordReset(email: string, rawToken: string): Promise<void> {
    if (!this.transporter || !this.env.SMTP_FROM) {
      throw new Error("SMTP is not configured");
    }

    const resetUrl = new URL("/reset-password", this.env.APP_URL);
    resetUrl.searchParams.set("token", rawToken);

    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to: email,
      subject: "Leeford Healthcare | Password Reset Request",
      text: `Leeford Healthcare\n\nA password reset was requested for your admin account. Use this secure link within 45 minutes:\n${resetUrl.toString()}\n\nIf you did not request this change, you can ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#17233c;line-height:1.6;max-width:600px;margin:auto">
          <h1 style="font-size:22px;color:#123f68">Leeford Healthcare</h1>
          <h2 style="font-size:18px">Password Reset Request</h2>
          <p>A password reset was requested for your admin account.</p>
          <p><a href="${resetUrl.toString()}" style="display:inline-block;background:#176b87;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px">Reset password</a></p>
          <p>This link expires in 45 minutes and can be used only once.</p>
          <p>If you did not request this change, you can safely ignore this email.</p>
        </div>`,
    });
  }
}
