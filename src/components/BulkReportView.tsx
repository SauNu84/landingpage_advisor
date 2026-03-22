"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { ExpertCard } from "@/components/ExpertCard";
import { ScoreGauge } from "@/components/ScoreGauge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { BulkAnalysisResult, AnalysisResult, ExpertName } from "@/lib/experts/types";

const EXPERT_META_ICONS: Record<ExpertName, string> = {
  "ui-design": "🎨",
  "ux-research": "🔍",
  experiment: "🧪",
  content: "✍️",
  seo: "📈",
  psychology: "🧠",
};

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

interface RankedResult {
  result: AnalysisResult;
  overall: number;
  rank: number;
}

interface Props {
  result: BulkAnalysisResult;
  slug: string;
  shared?: boolean;
}

export function BulkReportView({ result, slug, shared = false }: Props) {
  const t = useTranslations("BulkPage");
  const tCommon = useTranslations("Common");
  const tMeta = useTranslations("ExpertMeta");
  const tShared = useTranslations("SharedReport");

  const EXPERT_META: Record<ExpertName, { label: string; icon: string }> = {
    "ui-design": { label: tMeta("uiDesign"), icon: EXPERT_META_ICONS["ui-design"] },
    "ux-research": { label: tMeta("uxResearch"), icon: EXPERT_META_ICONS["ux-research"] },
    experiment: { label: tMeta("experiment"), icon: EXPERT_META_ICONS["experiment"] },
    content: { label: tMeta("content"), icon: EXPERT_META_ICONS["content"] },
    seo: { label: tMeta("seo"), icon: EXPERT_META_ICONS["seo"] },
    psychology: { label: tMeta("psychology"), icon: EXPERT_META_ICONS["psychology"] },
  };

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const expertKeys = Object.keys(result.results[0]?.experts ?? {}) as ExpertName[];

  const ranked: RankedResult[] = result.results
    .map((r) => ({ result: r, overall: averageScore(r) }))
    .sort((a, b) => b.overall - a.overall)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const winner = ranked[0];

  function copyShareLink() {
    const shareUrl = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Shared banner */}
      {shared && (
        <div className="bg-indigo-600 text-white text-center py-2 px-4 text-sm">
          {tShared("banner")}{" "}
          <Link href="/" className="underline font-medium">
            {tShared("analyzeOwn")}
          </Link>
        </div>
      )}

      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.36 3.36 0 0114 17H10a3.36 3.36 0 01-2.39-.991l-.346-.346z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">{tCommon("appName")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/" className="text-sm text-indigo-600 font-medium hover:underline">
              {shared ? tShared("analyzeYourPage") : t("back")}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-8">

        {/* Winner banner */}
        {winner && (
          <section className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide mb-1">
              {t("winner")} · {result.urls.length} {t("pagesAnalyzed")}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl font-bold">{winner.overall}</span>
                </div>
                <p className="text-xs text-indigo-200 text-center mt-1">{t("outOf100")}</p>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold truncate">{hostname(winner.result.url)}</p>
                <p className="text-indigo-200 text-sm truncate">{winner.result.url}</p>
                <p className="text-indigo-200 text-xs mt-1">
                  {t("analysedAt", { date: new Date(result.analysedAt).toLocaleString() })}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Ranking table */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {t("rankingTable")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 text-left border-b border-gray-100">
                  <th className="pb-3 font-medium w-8">{t("tableHeaders.rank")}</th>
                  <th className="pb-3 font-medium">{t("tableHeaders.url")}</th>
                  <th className="pb-3 font-medium text-center">{t("tableHeaders.overall")}</th>
                  {expertKeys.map((k) => (
                    <th key={k} className="pb-3 font-medium text-center hidden md:table-cell">
                      {EXPERT_META[k].icon}
                    </th>
                  ))}
                  <th className="pb-3 font-medium text-right">{t("tableHeaders.details")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ranked.map(({ result: r, overall, rank }) => (
                  <tr key={r.url} className={rank === 1 ? "bg-indigo-50/50" : ""}>
                    <td className="py-3 pr-2">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          rank === 1
                            ? "bg-indigo-600 text-white"
                            : rank === 2
                            ? "bg-gray-200 text-gray-700"
                            : rank === 3
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {rank}
                      </span>
                    </td>
                    <td className="py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[180px]">
                        {hostname(r.url)}
                      </p>
                      <p className="text-xs text-gray-400 truncate max-w-[180px]">{r.url}</p>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex justify-center">
                        <ScoreGauge score={overall} size="sm" />
                      </div>
                    </td>
                    {expertKeys.map((k) => (
                      <td key={k} className="py-3 text-center hidden md:table-cell">
                        <div className="flex justify-center">
                          <ScoreGauge score={r.experts[k].score} size="sm" />
                        </div>
                      </td>
                    ))}
                    <td className="py-3 text-right">
                      <button
                        onClick={() =>
                          setExpandedIndex(
                            expandedIndex === ranked.findIndex((rr) => rr.result.url === r.url)
                              ? null
                              : ranked.findIndex((rr) => rr.result.url === r.url)
                          )
                        }
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {expandedIndex === ranked.findIndex((rr) => rr.result.url === r.url)
                          ? t("hideDetails")
                          : t("viewDetails")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Expanded per-URL detail cards */}
        {ranked.map(({ result: r, rank }, idx) =>
          expandedIndex === idx ? (
            <section
              key={r.url}
              className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                    rank === 1
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {rank}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{hostname(r.url)}</p>
                  <p className="text-xs text-gray-400 truncate">{r.url}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {expertKeys.map((k) => (
                  <ExpertCard
                    key={k}
                    name={EXPERT_META[k].label}
                    icon={EXPERT_META[k].icon}
                    analysis={r.experts[k]}
                  />
                ))}
              </div>
            </section>
          ) : null
        )}

        {/* Share CTA */}
        <div className="text-center pb-4">
          <button
            onClick={copyShareLink}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg text-sm text-gray-700 font-medium shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? t("share.copied") : t("share.button")}
          </button>
        </div>
      </div>
    </main>
  );
}
