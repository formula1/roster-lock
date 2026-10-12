import { Env } from "../types";

export async function sendValidationEmail(env: Env, email: string, token: string): Promise<void> {
  // Email sending logic (e.g. Mailgun, SendGrid, Resend, or Cloudflare Email Routing)
  console.log(`[Email Service] Sending validation token '${token}' to ${email}`);
}
