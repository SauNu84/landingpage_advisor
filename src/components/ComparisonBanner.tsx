"use client";

import { useTranslations } from "next-intl";
import type { AnalysisResult, ExpertName } from "@/lib/experts/types";

interface ComparisonBannerProps {
  url1: string;
  url2: string;
  result1: AnalysisResult;
  result2: AnalysisResult;
}

function averageScore(result: AnalysisResult): number {
  const scores = Object.values(result.experts).map((e) => e.score);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ComparisonBanner({
  url1,
  url2,
  result1,
  result2,
}: ComparisonBannerProps) {
  const t = useTranslations("ComparisonBanner");
  const score1 = averageScore(result1);
  const score2 = averageScore(result2);
  const delta = score1 - score2;

  const expertNames = Object.keys(result1.experts) as ExpertName[];
  const wins1 = expertNames.filter(
    (k) => result1.experts[k].score > result2.experts[k].score
  ).length;
  const wins2 = expertNames.filter(
    (k) => result2.experts[k].score > result1.experts[k].score
  ).length;

  const overallWinner =
    delta > 0 ? "page1" : delta < 0 ? "page2" : "tie";

  return (
    <div
      className={`rounded-2xl border p-6 ${
        overallWinner === "page1"
          ? "bg-green-50 border-green-200"
          : overallWinner === "page2"
          ? "bg-amber-50 border-amber-200"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
        {t("overallComparison")}
      </p>

      {overallWinner === "tie" ? (
        <h2 className="text-xl font-bold text-gray-700 mb-4">
          {t("itsATie")}
        </h2>
      ) : (
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {t("winsOverall", {
            hostname: hostname(overallWinner === "page1" ? url1 : url2),
            points: Math.abs(delta),
          })}
        </h2>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Page 1 */}
        <div
          className={`rounded-xl p-4 ${
            overallWinner === "page1"
              ? "bg-green-100 border border-green-300"
              : "bg-white border border-gray-200"
          }`}
        >
          {overallWinner === "page1" && (
            <span className="inline-block text-xs font-semibold bg-green-600 text-white px-2 py-0.5 rounded-full mb-2">
              {t("winner")}
            </span>
          )}
          <p className="text-xs text-gray-500 mb-1 truncate">{t("myPage")}</p>
          <p className="text-sm font-semibold text-gray-800 truncate mb-2">
            {hostname(url1)}
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900">{score1}</span>
            <span className="text-sm text-gray-400 mb-0.5">{t("outOf100")}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t("winsCategories", { wins: wins1, total: expertNames.length })}
          </p>
        </div>

        {/* Page 2 */}
        <div
          className={`rounded-xl p-4 ${
            overallWinner === "page2"
              ? "bg-amber-100 border border-amber-300"
              : "bg-white border border-gray-200"
          }`}
        >
          {overallWinner === "page2" && (
            <span className="inline-block text-xs font-semibold bg-amber-600 text-white px-2 py-0.5 rounded-full mb-2">
              {t("winner")}
            </span>
          )}
          <p className="text-xs text-gray-500 mb-1 truncate">{t("competitor")}</p>
          <p className="text-sm font-semibold text-gray-800 truncate mb-2">
            {hostname(url2)}
          </p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900">{score2}</span>
            <span className="text-sm text-gray-400 mb-0.5">{t("outOf100")}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t("winsCategories", { wins: wins2, total: expertNames.length })}
          </p>
        </div>
      </div>
    </div>
  );
}
