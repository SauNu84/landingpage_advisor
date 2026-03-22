import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const OTP_EXPIRY_MINUTES = 15;

function generateOtp(): string {
  // Use CSPRNG — Math.random() is not suitable for security tokens
  return randomInt(100000, 1000000).toString();
}

export async function POST(request: NextRequest) {
  let email: string;
  try {
    const body = await request.json();
    email = body?.email?.trim()?.toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Ensure user exists before creating OTP (FK constraint on OtpToken.email -> User.email)
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // Invalidate previous unused OTPs for this email
  await prisma.otpToken.updateMany({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() }, // expire them immediately
  });

  const token = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpToken.create({
    data: { email, token, expiresAt },
  });

  try {
    await sendOtpEmail(email, token);
  } catch (err) {
    logger.error("request-otp", "Failed to send OTP email", err, { email });
    return NextResponse.json(
      { error: "Failed to send sign-in email. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
