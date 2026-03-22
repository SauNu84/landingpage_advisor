import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");

  const analyses = await prisma.analysisResult.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1, // fetch one extra to know if there's a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      slug: true,
      url: true,
      secondaryUrl: true,
      data: true,
      createdAt: true,
    },
  });

  const hasMore = analyses.length > PAGE_SIZE;
  const items = hasMore ? analyses.slice(0, PAGE_SIZE) : analyses;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  // Extract overall score from JSON data for each item
  const results = items.map((item) => {
    let overallScore: number | null = null;
    let expertScores: Record<string, number> = {};
    try {
      const parsed = JSON.parse(item.data) as {
        experts?: Record<string, { score?: number }>;
      };
      if (parsed.experts) {
        const scores = Object.values(parsed.experts)
          .map((e) => e.score ?? 0)
          .filter((s) => s > 0);
        overallScore =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null;
        expertScores = Object.fromEntries(
          Object.entries(parsed.experts).map(([k, v]) => [k, v.score ?? 0])
        );
      }
    } catch {
      // ignore parse errors
    }

    return {
      id: item.id,
      slug: item.slug,
      url: item.url,
      secondaryUrl: item.secondaryUrl,
      overallScore,
      expertScores,
      createdAt: item.createdAt,
      isComparison: !!item.secondaryUrl,
    };
  });

  return NextResponse.json({ results, nextCursor });
}
