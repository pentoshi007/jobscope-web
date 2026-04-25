import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { Resend } from "resend";
import { env } from "./env";
import { mongoClient } from "./db";

const resend = new Resend(env.RESEND_API_KEY);

function emailHtml(title: string, intro: string, ctaText: string, ctaUrl: string) {
  return `
<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;background:#fafafa;padding:40px 20px;color:#171717;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #ebebeb;padding:32px;">
    <tr><td>
      <div style="font-size:13px;letter-spacing:0.04em;color:#7c7c7c;text-transform:uppercase;font-weight:600;margin-bottom:24px;">JobScope</div>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;font-weight:600;">${title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#525252;margin:0 0 24px;">${intro}</p>
      <a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">${ctaText}</a>
      <p style="font-size:13px;color:#a1a1a1;margin:32px 0 0;">If the button doesn't work, paste this link: <br/><span style="color:#4f46e5;word-break:break-all;">${ctaUrl}</span></p>
    </td></tr>
  </table>
</body></html>`;
}

export const auth = betterAuth({
  database: mongodbAdapter(mongoClient.db()),
  secret: env.AUTH_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [
    env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: user.email,
        subject: "Reset your JobScope password",
        html: emailHtml(
          "Reset your password",
          "Click the button below to choose a new password. This link expires in 1 hour.",
          "Reset password",
          url,
        ),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: user.email,
        subject: "Verify your JobScope email",
        html: emailHtml(
          "Verify your email",
          `Welcome to JobScope${user.name ? `, ${user.name}` : ""}. Confirm your email to start matching jobs to your resume.`,
          "Verify email",
          url,
        ),
      });
    },
  },
  socialProviders: {
    google: {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      preferences: { type: "string", required: false, defaultValue: "{}" },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
