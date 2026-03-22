"use client";

import { useState } from "react";
import { ScoreGauge } from "./ScoreGauge";
import type { ExpertAnalysis, Recommendation } from "@/lib/experts/types";

const PRIORITY_BADGE: Record<Recommendation["priority"], string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-50 text-gray-600 border-gray-200",
};

interface ExpertCardProps {
  name: string;
  icon: string;
  analysis: ExpertAnalysis;
  /** Score delta relative to the other page (positive = this page wins) */
  delta?: number;
}

export function ExpertCard({ name, icon, analysis, delta }: ExpertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const topRecs = analysis.recommendations
    .filter((r) => r.priority === "high")
    .slice(0, 3);
  const allRecs = analysis.recommendations;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <div className="flex-shrink-0">
          <ScoreGauge score={analysis.score} size="md" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{icon}</span>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">
              {name}
            </h3>
            {delta !== undefined && delta !== 0 && (
              <span
                className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  delta > 0
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
            {delta === 0 && (
              <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                tie
              </span>
            )}
          </div>
          <p className="text-gray-600 text-xs leading-relaxed line-clamp-3">
            {analysis.summary}
          </p>
        </div>
      </div>

      {/* Top recommendations */}
      {topRecs.length > 0 && (
        <div className="px-5 pb-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Top priorities
          </p>
          {topRecs.map((rec, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span
                className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[rec.priority]}`}
              >
                {rec.priority}
              </span>
              <p className="text-xs text-gray-700 leading-snug">{rec.action}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 text-xs text-indigo-600 font-medium bg-indigo-50 hover:bg-indigo-100 transition-colors text-left flex justify-between items-center"
      >
        <span>{expanded ? "Hide details" : "Show all details"}</span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
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

      {/* Expanded details */}
      {expanded && (
        <div className="p-5 space-y-4 border-t border-gray-50">
          {analysis.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-700 mb-2">
                ✓ Strengths
              </p>
              <ul className="space-y-1">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600 leading-snug">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-700 mb-2">
                ✗ Weaknesses
              </p>
              <ul className="space-y-1">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-gray-600 leading-snug">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {allRecs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                All Recommendations
              </p>
              <div className="space-y-2">
                {allRecs.map((rec, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex gap-2 items-start mb-1">
                      <span
                        className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[rec.priority]}`}
                      >
                        {rec.priority}
                      </span>
                      <p className="text-xs text-gray-800 font-medium leading-snug">
                        {rec.action}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 ml-0 mt-1">
                      Impact: {rec.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
