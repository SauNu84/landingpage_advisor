"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpertCard } from "@/components/ExpertCard";
import { ComparisonBanner } from "@/components/ComparisonBanner";
import { ScoreGauge } from "@/components/ScoreGauge";
import type { AnalysisResult, ExpertName } from "@/lib/experts/types";
import type { ComparisonResult } from "@/app/api/compare/route";

const EXPERT_META: Record<ExpertName, { label: string; icon: string }> = {
  "ui-design": { label: "UI / Design System", icon: "🎨" },
  "ux-research": { label: "UX Research", icon: "🔍" },
  experiment: { label: "Experiment Designer", icon: "🧪" },
  content: { label: "Content / Copy", icon: "✍️" },
  seo: { label: "SEO Expert", icon: "📈" },
  psychology: { label: "Marketing Psychology", icon: "🧠" },
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

export default function ComparePage() {
  const router = useRouter();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("compareResult");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  function copyShareLink() {
    if (!result?.slug) return;
    const url = `${window.location.origin}/r/${result.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!result) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const expertKeys = Object.keys(result.result1.experts) as ExpertName[];
  const overall1 = averageScore(result.result1);
  const overall2 = averageScore(result.result2);

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.36 3.36 0 0114 17H10a3.36 3.36 0 01-2.39-.991l-.346-.346z"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">
              Landing Page Advisor
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-indigo-600 font-medium hover:underline"
          >
            ← Compare another
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-8">
        {/* Overall comparison banner */}
        <ComparisonBanner
          url1={result.url1}
          url2={result.url2}
          result1={result.result1}
          result2={result.result2}
        />

        {/* Per-expert score strips */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Score Summary
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 text-left">
                  <th className="pb-3 font-medium">Expert</th>
                  <th className="pb-3 font-medium text-center">
                    My Page
                    <span className="block text-gray-300 font-normal truncate max-w-[120px]">
                      {hostname(result.url1)}
                    </span>
                  </th>
                  <th className="pb-3 font-medium text-center">
                    Competitor
                    <span className="block text-gray-300 font-normal truncate max-w-[120px]">
                      {hostname(result.url2)}
                    </span>
                  </th>
                  <th className="pb-3 font-medium text-center">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expertKeys.map((k) => {
                  const s1 = result.result1.experts[k].score;
                  const s2 = result.result2.experts[k].score;
                  const d = s1 - s2;
                  return (
                    <tr key={k}>
                      <td className="py-3">
                        <span className="mr-1">{EXPERT_META[k].icon}</span>
                        {EXPERT_META[k].label}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center">
                          <ScoreGauge score={s1} size="sm" />
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center">
                          <ScoreGauge score={s2} size="sm" />
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            d > 0
                              ? "bg-green-100 text-green-700"
                              : d < 0
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {d > 0 ? `+${d}` : d === 0 ? "tie" : d}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Overall row */}
                <tr className="font-semibold">
                  <td className="py-3">Overall</td>
                  <td className="py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreGauge score={overall1} size="sm" />
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex justify-center">
                      <ScoreGauge score={overall2} size="sm" />
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        overall1 - overall2 > 0
                          ? "bg-green-100 text-green-700"
                          : overall1 - overall2 < 0
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {overall1 - overall2 > 0
                        ? `+${overall1 - overall2}`
                        : overall1 - overall2 === 0
                        ? "tie"
                        : overall1 - overall2}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Side-by-side expert cards */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Expert Analyses — Side by Side
          </h2>
          <div className="space-y-6">
            {expertKeys.map((k) => {
              const d1 = result.result1.experts[k].score - result.result2.experts[k].score;
              const d2 = -d1;
              return (
                <div key={k}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    {EXPERT_META[k].icon} {EXPERT_META[k].label}
                  </h3>
                  {/* Responsive: side-by-side on md+, stacked on mobile */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        My Page · {hostname(result.url1)}
                      </p>
                      <ExpertCard
                        name={EXPERT_META[k].label}
                        icon={EXPERT_META[k].icon}
                        analysis={result.result1.experts[k]}
                        delta={d1}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        Competitor · {hostname(result.url2)}
                      </p>
                      <ExpertCard
                        name={EXPERT_META[k].label}
                        icon={EXPERT_META[k].icon}
                        analysis={result.result2.experts[k]}
                        delta={d2}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Share CTA */}
        {result.slug && (
          <div className="text-center pb-4">
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg text-sm text-gray-700 font-medium shadow-sm transition-colors"
            >
              <svg
                className="w-4 h-4 text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {copied ? "Link copied!" : "Share this comparison"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
