"use client";

import { useState } from "react";
import Link from "next/link";
import { ExpertCard } from "@/components/ExpertCard";
import { PostHogGuide } from "@/components/PostHogGuide";
import { ScoreGauge } from "@/components/ScoreGauge";
import type { AnalysisResult, ExpertName } from "@/lib/experts/types";

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

interface Props {
  result: AnalysisResult;
  slug: string;
}

export function SharedReportView({ result, slug }: Props) {
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [copied, setCopied] = useState(false);

  const overall = averageScore(result);
  const expertKeys = Object.keys(result.experts) as ExpertName[];

  const topRecs = expertKeys
    .flatMap((k) =>
      result.experts[k].recommendations
        .filter((r) => r.priority === "high")
        .slice(0, 2)
        .map((r) => ({ ...r, expert: EXPERT_META[k].label }))
    )
    .slice(0, 6);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setEmailStatus("loading");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug }),
      });
      setEmailStatus(res.ok ? "done" : "error");
    } catch {
      setEmailStatus("error");
    }
  }

  function copyShareLink() {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Shared report banner */}
      <div className="bg-indigo-600 text-white text-center py-2 px-4 text-sm">
        This is a shared report.{" "}
        <Link href="/" className="underline font-medium">
          Analyze your own page →
        </Link>
      </div>

      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.36 3.36 0 0114 17H10a3.36 3.36 0 01-2.39-.991l-.346-.346z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Landing Page Advisor</span>
          </div>
          <Link href="/" className="text-sm text-indigo-600 font-medium hover:underline">
            Analyze your page →
          </Link>
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
              <h1 className="text-xl font-bold text-gray-900 mb-1 truncate">{result.url}</h1>
              <p className="text-xs text-gray-400">
                Analysed {new Date(result.analysedAt).toLocaleString()}
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                {expertKeys.map((k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="text-base">{EXPERT_META[k].icon}</span>
                    <ScoreGauge score={result.experts[k].score} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {topRecs.length > 0 && (
            <div className="mt-6 border-t border-gray-50 pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                Top priority actions
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {topRecs.map((rec, i) => (
                  <div key={i} className="flex gap-2 items-start bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <span className="flex-shrink-0 text-xs text-red-600 font-medium mt-0.5">
                      {rec.expert.split(" ")[0]}
                    </span>
                    <p className="text-xs text-gray-700 leading-snug">{rec.action}</p>
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
                disabled={emailStatus === "loading"}
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

        {/* Share link */}
        <div className="text-center pb-4">
          <button
            onClick={copyShareLink}
            className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? "Link copied!" : "Copy share link"}
          </button>
        </div>
      </div>
    </main>
  );
}
