import { logger } from "@/lib/logger";

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn(
      "email",
      "RESEND_API_KEY is not set — email not sent (dev mode only)",
      { to, otp }
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from =
    process.env.EMAIL_FROM ?? "Landing Page Advisor <noreply@landingpageadvisor.com>";

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Your Landing Page Advisor sign-in code",
    text: `Your sign-in code is: ${otp}\n\nThis code expires in 15 minutes. Do not share it.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4f46e5;">Landing Page Advisor</h2>
        <p>Your sign-in code is:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e1b4b; padding: 16px 0;">${otp}</div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 15 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });

  if (error) {
    logger.error("email", "Resend API error — failed to send OTP email", error, { to });
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
}
