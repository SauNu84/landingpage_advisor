"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingExpert } from "@/components/LoadingExpert";

const EXPERT_LABELS: string[] = [
  "UI/Design System Analyst",
  "UX Research Designer",
  "Experiment Designer",
  "Content/Copy Analyst",
  "SEO Expert",
  "Marketing Psychologist",
  "PostHog Tracking Advisor",
];

const COMPARE_EXPERT_LABELS: string[] = [
  "Scraping both pages…",
  "UI/Design analysis (×2)…",
  "UX Research analysis (×2)…",
  "Experiment Designer (×2)…",
  "Content/Copy analysis (×2)…",
  "SEO analysis (×2)…",
  "Marketing Psychology (×2)…",
  "PostHog Advisor (×2)…",
];

type Mode = "single" | "compare";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("single");
  const [url, setUrl] = useState("");
  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentExpert, setCurrentExpert] = useState(0);

  function validateUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function normalise(value: string): string {
    return value.startsWith("http://") || value.startsWith("https://")
      ? value.trim()
      : `https://${value.trim()}`;
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }

    const norm = normalise(url);
    if (!validateUrl(norm)) {
      setError("Please enter a valid URL (e.g. https://example.com).");
      return;
    }

    setLoading(true);
    setCurrentExpert(0);

    const interval = setInterval(() => {
      setCurrentExpert((prev) =>
        prev < EXPERT_LABELS.length - 1 ? prev + 1 : prev
      );
    }, 4000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: norm }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Analysis failed.");
      }

      sessionStorage.setItem("analysisResult", JSON.stringify(data));
      router.push("/analyze");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error.";
      setError(msg);
      setLoading(false);
    } finally {
      clearInterval(interval);
    }
  }

  async function handleCompareSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url1.trim() || !url2.trim()) {
      setError("Please enter both URLs.");
      return;
    }

    const norm1 = normalise(url1);
    const norm2 = normalise(url2);

    if (!validateUrl(norm1) || !validateUrl(norm2)) {
      setError("Please enter valid URLs for both pages.");
      return;
    }

    setLoading(true);
    setCurrentExpert(0);

    const interval = setInterval(() => {
      setCurrentExpert((prev) =>
        prev < COMPARE_EXPERT_LABELS.length - 1 ? prev + 1 : prev
      );
    }, 5000);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url1: norm1, url2: norm2 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Comparison failed.");
      }

      sessionStorage.setItem("compareResult", JSON.stringify(data));
      router.push("/compare");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error.";
      setError(msg);
      setLoading(false);
    } finally {
      clearInterval(interval);
    }
  }

  if (loading) {
    return (
      <LoadingExpert
        experts={mode === "compare" ? COMPARE_EXPERT_LABELS : EXPERT_LABELS}
        currentIndex={currentExpert}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <svg
              className="w-8 h-8 text-white"
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Landing Page Advisor
          </h1>
          <p className="text-gray-500 text-lg">
            Get expert-quality feedback on any landing page — in seconds.
          </p>
        </div>

        {/* Expert badges */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {[
            "UI/Design",
            "UX Research",
            "Experiments",
            "Content",
            "SEO",
            "Psychology",
            "PostHog",
          ].map((label) => (
            <span
              key={label}
              className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("single"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "single"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Single URL
          </button>
          <button
            type="button"
            onClick={() => { setMode("compare"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "compare"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Compare Pages
          </button>
        </div>

        {/* Single URL form */}
        {mode === "single" && (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Landing page URL
              </label>
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-landing-page.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-colors text-base"
            >
              Analyze Page
            </button>
          </form>
        )}

        {/* Compare form */}
        {mode === "compare" && (
          <form onSubmit={handleCompareSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="url1"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                My Page
              </label>
              <input
                id="url1"
                type="text"
                value={url1}
                onChange={(e) => setUrl1(e.target.value)}
                placeholder="https://my-landing-page.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="url2"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Competitor Page
              </label>
              <input
                id="url2"
                type="text"
                value={url2}
                onChange={(e) => setUrl2(e.target.value)}
                placeholder="https://competitor.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-colors text-base"
            >
              Compare Pages
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Claude · 6 expert analyses + PostHog tracking guide
        </p>
      </div>
    </main>
  );
}
