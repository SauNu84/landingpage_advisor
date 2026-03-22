import { prisma } from "./db";

const ANON_DAILY_LIMIT = parseInt(process.env.ANON_DAILY_LIMIT ?? "10", 10);
const AUTH_DAILY_LIMIT = parseInt(process.env.AUTH_DAILY_LIMIT ?? "20", 10);
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
}

export async function checkAnalysisRateLimit(
  userId: string | null,
  ip: string
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS);

  if (userId) {
    const count = await prisma.analysisResult.count({
      where: { userId, createdAt: { gte: since } },
    });
    return {
      allowed: count < AUTH_DAILY_LIMIT,
      limit: AUTH_DAILY_LIMIT,
      remaining: Math.max(0, AUTH_DAILY_LIMIT - count),
    };
  }

  const count = await prisma.analysisResult.count({
    where: { ip, userId: null, createdAt: { gte: since } },
  });
  return {
    allowed: count < ANON_DAILY_LIMIT,
    limit: ANON_DAILY_LIMIT,
    remaining: Math.max(0, ANON_DAILY_LIMIT - count),
  };
}

export function getClientIp(request: Request): string {
  const forwarded = (request.headers as Headers).get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "127.0.0.1";
}
