import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  sessionCookieHeader,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  let email: string;
  let token: string;
  try {
    const body = await request.json();
    email = body?.email?.trim()?.toLowerCase();
    token = body?.token?.trim();
    if (!email || !token) {
      return NextResponse.json(
        { error: "email and token are required" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Find valid, unused OTP
  const otp = await prisma.otpToken.findFirst({
    where: {
      email,
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otp) {
    return NextResponse.json(
      { error: "Invalid or expired code" },
      { status: 401 }
    );
  }

  // Mark OTP as used
  await prisma.otpToken.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const sessionToken = await createSessionToken({
    userId: user.id,
    email: user.email,
  });

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  });
  response.headers.set("Set-Cookie", sessionCookieHeader(sessionToken));
  return response;
}
