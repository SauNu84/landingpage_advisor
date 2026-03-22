"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpertCard } from "@/components/ExpertCard";
import { PostHogGuide } from "@/components/PostHogGuide";
import { ScoreGauge } from "@/components/ScoreGauge";
import { DownloadPDFButton } from "@/components/DownloadPDFButton";
import type { AnalysisResult, ExpertName } from "@/lib/experts/types";

interface StoredResult extends AnalysisResult {
  slug?: string;
}

const EXPERT_META: Record<
  ExpertName,
  { label: string; icon: string }
> = {
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

export default function AnalyzePage() {
  const router = useRouter();
  const [result, setResult] = useState<StoredResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    const raw = sessionStorage.getItem("analysisResult");
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

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@") || !result?.slug) return;
    setEmailStatus("loading");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug: result.slug }),
      });
      setEmailStatus(res.ok ? "done" : "error");
    } catch {
      setEmailStatus("error");
    }
  }

  if (!result) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const overall = averageScore(result);
  const expertKeys = Object.keys(result.experts) as ExpertName[];

  // Aggregate top high-priority recommendations across all experts
  const topRecs = expertKeys
    .flatMap((k) =>
      result.experts[k].recommendations
        .filter((r) => r.priority === "high")
        .slice(0, 2)
        .map((r) => ({ ...r, expert: EXPERT_META[k].label }))
    )
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <DownloadPDFButton result={result} slug={result.slug} />
            <button
              onClick={() => router.push("/")}
              className="text-sm text-indigo-600 font-medium hover:underline"
            >
              ← Analyze another
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        {/* Overall summary */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-shrink-0">
              <ScoreGauge score={overall} size="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 mb-1">
                Overall score · {expertKeys.length} experts
              </p>
              <h1 className="text-xl font-bold text-gray-900 mb-1 truncate">
                {result.url}
              </h1>
              <p className="text-xs text-gray-400">
                Analysed {new Date(result.analysedAt).toLocaleString()}
              </p>

              {/* Per-expert score strip */}
              <div className="flex flex-wrap gap-3 mt-4">
                {expertKeys.map((k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="text-base">
                      {EXPERT_META[k].icon}
                    </span>
                    <ScoreGauge score={result.experts[k].score} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top priority recommendations */}
          {topRecs.length > 0 && (
            <div className="mt-6 border-t border-gray-50 pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                Top priority actions
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {topRecs.map((rec, i) => (
                  <div
                    key={i}
                    className="flex gap-2 items-start bg-red-50 border border-red-100 rounded-xl px-3 py-2"
                  >
                    <span className="flex-shrink-0 text-xs text-red-600 font-medium mt-0.5">
                      {rec.expert.split(" ")[0]}
                    </span>
                    <p className="text-xs text-gray-700 leading-snug">
                      {rec.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Expert cards grid */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Expert Analyses
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {expertKeys.map((k) => (
              <ExpertCard
                key={k}
                name={EXPERT_META[k].label}
                icon={EXPERT_META[k].icon}
                analysis={result.experts[k]}
              />
            ))}
          </div>
        </section>

        {/* PostHog guide */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            PostHog Tracking Plan
          </h2>
          <PostHogGuide advice={result.posthog} />
        </section>

        {/* Email capture */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            Email me this report
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Get a copy of this report sent to your inbox.
          </p>
          {emailStatus === "done" ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Report link sent to your inbox
            </p>
          ) : (
            <form onSubmit={handleEmailSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={emailStatus === "loading"}
              />
              <button
                type="submit"
                disabled={emailStatus === "loading" || !result.slug}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {emailStatus === "loading" ? "Sending…" : "Send"}
              </button>
            </form>
          )}
          {emailStatus === "error" && (
            <p className="text-xs text-red-600 mt-2">Something went wrong. Please try again.</p>
          )}
        </section>

        {/* Share CTA */}
        {result.slug && (
          <div className="text-center pb-4">
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-indigo-300 rounded-lg text-sm text-gray-700 font-medium shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? "Link copied!" : "Share this report"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
