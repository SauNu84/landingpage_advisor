"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type {
  PostHogAdvice,
  TrackingPoint,
  DashboardSuggestion,
  PostHogLiveData,
  TrackingStatus,
} from "@/lib/experts/types";

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

const STATUS_BADGES: Record<TrackingStatus, { icon: string; className: string }> = {
  tracked: { icon: "✅", className: "text-green-700 bg-green-50 border-green-200" },
  low_volume: { icon: "⚠️", className: "text-amber-700 bg-amber-50 border-amber-200" },
  not_tracked: { icon: "❌", className: "text-red-700 bg-red-50 border-red-200" },
};

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("PostHogGuide");
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
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

function TrackingCard({ point }: { point: TrackingPoint }) {
  const t = useTranslations("PostHogGuide");
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
                <p className="text-xs font-medium text-indigo-700 mb-0.5">{t("businessBenefit")}</p>
                <p className="text-xs text-indigo-900 leading-snug">{point.benefit}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs font-medium text-indigo-700 mb-0.5">{t("postHogView")}</p>
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
              <p className="text-xs text-gray-500 mb-1">{t("properties")}</p>
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

function LiveDataTab({ liveData }: { liveData: PostHogLiveData }) {
  const t = useTranslations("PostHogGuide");

  const tracked = liveData.eventStatuses.filter((s) => s.status === "tracked").length;
  const lowVolume = liveData.eventStatuses.filter((s) => s.status === "low_volume").length;
  const notTracked = liveData.eventStatuses.filter((s) => s.status === "not_tracked").length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{tracked}</p>
          <p className="text-xs text-green-600">{t("liveData.tracked")}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{lowVolume}</p>
          <p className="text-xs text-amber-600">{t("liveData.lowVolume")}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{notTracked}</p>
          <p className="text-xs text-red-600">{t("liveData.notTracked")}</p>
        </div>
      </div>

      {/* Event status table */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          {t("liveData.recommendedEvents")}
        </p>
        <div className="space-y-2">
          {liveData.eventStatuses.map((status, i) => {
            const badge = STATUS_BADGES[status.status];
            return (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                  status.status === "not_tracked" ? "border-red-100 bg-red-50/50" : "border-gray-100 bg-white"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-xs text-orange-600 font-mono truncate">
                    {status.recommendedEvent}
                  </code>
                </div>
                <span
                  className={`flex-shrink-0 ml-3 text-xs font-medium px-2 py-0.5 rounded-full border ${badge.className}`}
                >
                  {badge.icon} {t(`liveData.status.${status.status}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top events from PostHog */}
      {liveData.topEvents.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            {t("liveData.topEvents")}
          </p>
          <div className="space-y-2">
            {liveData.topEvents.map((event, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-white border border-gray-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4 text-right">{i + 1}.</span>
                  <code className="text-xs font-mono text-gray-800">{event.name}</code>
                </div>
                <div className="text-right">
                  {event.volume30Day != null && (
                    <span className="text-xs font-semibold text-indigo-700">
                      {event.volume30Day.toLocaleString()} {t("liveData.events30d")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        {t("liveData.refreshedAt", { date: new Date(liveData.connectedAt).toLocaleString() })}
      </p>
    </div>
  );
}

interface PostHogGuideProps {
  advice: PostHogAdvice;
  liveData?: PostHogLiveData;
}

type TabId = "events" | "dashboards" | "live";

export function PostHogGuide({ advice, liveData }: PostHogGuideProps) {
  const t = useTranslations("PostHogGuide");
  const [activeTab, setActiveTab] = useState<TabId>("events");

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
            <h2 className="font-bold text-gray-900">{t("title")}</h2>
            <p className="text-xs text-gray-500">
              {t("subtitle", {
                events: advice.trackingPoints.length,
                dashboards: (advice.dashboards ?? []).length,
              })}
            </p>
          </div>
          {liveData && (
            <span className="ml-auto text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">
              {t("liveData.badge")}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {advice.strategy}
        </p>
      </div>

      {/* Key metrics */}
      {advice.keyMetrics.length > 0 && (
        <div className="px-6 py-4 bg-orange-50 border-b border-orange-100">
          <p className="text-xs font-medium text-orange-800 mb-2">
            {t("keyMetrics")}
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
          {t("tabs.events", { count: advice.trackingPoints.length })}
        </button>
        <button
          onClick={() => setActiveTab("dashboards")}
          className={`flex-1 py-3 text-xs font-medium transition-colors ${
            activeTab === "dashboards"
              ? "text-violet-700 border-b-2 border-violet-500 bg-violet-50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("tabs.dashboards", { count: (advice.dashboards ?? []).length })}
        </button>
        {liveData && (
          <button
            onClick={() => setActiveTab("live")}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === "live"
                ? "text-green-700 border-b-2 border-green-500 bg-green-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("tabs.liveData")}
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="p-6 space-y-2">
        {activeTab === "events" && (
          <>
            <p className="text-xs text-gray-400 mb-3">
              {t("eventsDescription")}
            </p>
            {advice.trackingPoints.map((point, i) => (
              <TrackingCard key={i} point={point} />
            ))}
          </>
        )}

        {activeTab === "dashboards" && (
          <>
            <p className="text-xs text-gray-400 mb-3">
              {t("dashboardsDescription")}
            </p>
            <div className="space-y-3">
              {(advice.dashboards ?? []).map((d, i) => (
                <DashboardCard key={i} dashboard={d} />
              ))}
              {(advice.dashboards ?? []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">{t("noDashboards")}</p>
              )}
            </div>
          </>
        )}

        {activeTab === "live" && liveData && (
          <LiveDataTab liveData={liveData} />
        )}
      </div>
    </div>
  );
}
