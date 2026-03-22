import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/encrypt";

function requireAuth(session: { userId: string; email: string } | null) {
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET — return current PostHog config (API key masked). */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const authError = requireAuth(session);
  if (authError) return authError;

  const config = await prisma.postHogConfig.findUnique({
    where: { userId: session!.userId },
  });

  if (!config) {
    return NextResponse.json({ connected: false });
  }

  // Mask API key — show only last 6 chars
  let maskedKey = "••••••••";
  try {
    const plain = decrypt(config.apiKey);
    maskedKey = "••••••" + plain.slice(-6);
  } catch {
    // decryption error — return masked placeholder
  }

  return NextResponse.json({
    connected: true,
    projectId: config.projectId,
    host: config.host,
    apiKeyMasked: maskedKey,
  });
}

/** POST — save (or update) PostHog config. */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const authError = requireAuth(session);
  if (authError) return authError;

  let apiKey: string;
  let projectId: string;
  let host: string;

  try {
    const body = await request.json();
    apiKey = body?.apiKey?.trim();
    projectId = body?.projectId?.trim();
    host = (body?.host?.trim() || "https://app.posthog.com").replace(/\/$/, "");

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
    }
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const encryptedKey = encrypt(apiKey);

  await prisma.postHogConfig.upsert({
    where: { userId: session!.userId },
    create: {
      userId: session!.userId,
      apiKey: encryptedKey,
      projectId,
      host,
    },
    update: {
      apiKey: encryptedKey,
      projectId,
      host,
    },
  });

  return NextResponse.json({ ok: true });
}

/** DELETE — remove PostHog config. */
export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const authError = requireAuth(session);
  if (authError) return authError;

  await prisma.postHogConfig.deleteMany({
    where: { userId: session!.userId },
  });

  return NextResponse.json({ ok: true });
}
