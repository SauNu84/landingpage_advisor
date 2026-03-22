"use client";

import { useState } from "react";
import type { PostHogAdvice, TrackingPoint, DashboardSuggestion } from "@/lib/experts/types";

const ANALYSIS_ICONS: Record<string, string> = {
  Funnel: "⬇️",
  Trends: "📈",
  Retention: "🔄",
  "Session Recording": "🎬",
  Heatmap: "🔥",
  Correlation: "🔗",
  "User Paths": "🗺️",
  "Feature Flags": "🧪",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function TrackingCard({ point }: { point: TrackingPoint }) {
  const [open, setOpen] = useState(false);
  const snippet = point.codeSnippet
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "  ");
  const analysisIcon = ANALYSIS_ICONS[point.analysisType] ?? "📊";

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 bg-orange-50 border border-orange-200 rounded text-orange-700 text-xs font-mono font-medium flex items-center justify-center">
            ⊙
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {point.element}
            </p>
            <code className="text-xs text-orange-600 font-mono">
              {point.event}
            </code>
          </div>
        </div>
        {/* Analysis type badge */}
        <span className="hidden sm:flex flex-shrink-0 items-center gap-1 ml-3 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-xs text-indigo-700 font-medium">
          <span>{analysisIcon}</span>
          <span>{point.analysisType}</span>
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Benefit + visualization row */}
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 space-y-2">
            <div className="flex flex-wrap gap-3 items-start">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-indigo-700 mb-0.5">Business benefit</p>
                <p className="text-xs text-indigo-900 leading-snug">{point.benefit}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs font-medium text-indigo-700 mb-0.5">PostHog view</p>
                <span className="inline-flex items-center gap-1 text-xs text-indigo-800 font-medium">
                  <span>{analysisIcon}</span>
                  <span>{point.visualization}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Properties */}
          {point.properties && Object.keys(point.properties).length > 0 && (
            <div className="px-4 py-2 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Properties</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(point.properties).map(([k, v]) => (
                  <span
                    key={k}
                    className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5"
                  >
                    <span className="text-gray-500">{k}:</span>{" "}
                    <span className="text-gray-700">{String(v)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Code snippet */}
          <div className="relative bg-gray-900 px-4 py-3">
            <CopyButton text={snippet} />
            <pre className="text-xs text-green-300 font-mono overflow-x-auto pr-16 whitespace-pre-wrap">
              {snippet}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardCard({ dashboard }: { dashboard: DashboardSuggestion }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-base">
          📊
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 mb-0.5">{dashboard.name}</p>
          <p className="text-xs text-gray-500 leading-snug mb-2">{dashboard.description}</p>
          <div className="flex flex-wrap gap-1">
            {dashboard.events.map((e) => (
              <code
                key={e}
                className="text-xs bg-violet-50 border border-violet-100 text-violet-700 rounded px-1.5 py-0.5 font-mono"
              >
                {e}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PostHogGuideProps {
  advice: PostHogAdvice;
}

export function PostHogGuide({ advice }: PostHogGuideProps) {
  const [activeTab, setActiveTab] = useState<"events" | "dashboards">("events");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-gray-900">PostHog Tracking Guide</h2>
            <p className="text-xs text-gray-500">
              {advice.trackingPoints.length} events · {(advice.dashboards ?? []).length} dashboards · copy-paste ready
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {advice.strategy}
        </p>
      </div>

      {/* Key metrics */}
      {advice.keyMetrics.length > 0 && (
        <div className="px-6 py-4 bg-orange-50 border-b border-orange-100">
          <p className="text-xs font-medium text-orange-800 mb-2">
            Key metrics to track
          </p>
          <div className="flex flex-wrap gap-2">
            {advice.keyMetrics.map((m) => (
              <code
                key={m}
                className="text-xs bg-white border border-orange-200 text-orange-700 rounded px-2 py-0.5 font-mono"
              >
                {m}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab("events")}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${
            activeTab === "events"
              ? "text-orange-700 border-b-2 border-orange-500 bg-orange-50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Event Tracking Plan ({advice.trackingPoints.length})
        </button>
        <button
          onClick={() => setActiveTab("dashboards")}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${
            activeTab === "dashboards"
              ? "text-violet-700 border-b-2 border-violet-500 bg-violet-50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Suggested Dashboards ({(advice.dashboards ?? []).length})
        </button>
      </div>

      {/* Tab content */}
      <div className="p-6 space-y-2">
        {activeTab === "events" && (
          <>
            <p className="text-xs text-gray-400 mb-3">
              Each event shows the recommended PostHog analysis type, visualization, and business benefit.
            </p>
            {advice.trackingPoints.map((point, i) => (
              <TrackingCard key={i} point={point} />
            ))}
          </>
        )}

        {activeTab === "dashboards" && (
          <>
            <p className="text-xs text-gray-400 mb-3">
              Build these dashboards in PostHog to monitor your landing page performance over time.
            </p>
            <div className="space-y-3">
              {(advice.dashboards ?? []).map((d, i) => (
                <DashboardCard key={i} dashboard={d} />
              ))}
              {(advice.dashboards ?? []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No dashboard suggestions available.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
