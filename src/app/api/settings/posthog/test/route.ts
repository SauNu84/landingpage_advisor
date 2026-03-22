import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { testPostHogConnection } from "@/lib/posthog-client";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let apiKey: string;
  let projectId: string;
  let host: string;

  try {
    const body = await request.json();
    apiKey = body?.apiKey?.trim();
    projectId = body?.projectId?.trim();
    host = (body?.host?.trim() || "https://app.posthog.com").replace(/\/$/, "");

    if (!apiKey || !projectId) {
      return NextResponse.json({ error: "apiKey and projectId are required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await testPostHogConnection(projectId, apiKey, host);
  return NextResponse.json(result);
}
