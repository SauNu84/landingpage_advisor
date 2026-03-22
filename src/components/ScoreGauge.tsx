"use client";

import { useTranslations } from "next-intl";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green
  if (score >= 60) return "#f59e0b"; // amber
  if (score >= 40) return "#f97316"; // orange
  return "#ef4444"; // red
}

export function ScoreGauge({ score, size = "md" }: ScoreGaugeProps) {
  const t = useTranslations("ScoreGauge");
  const radius = size === "sm" ? 28 : size === "lg" ? 48 : 36;
  const stroke = size === "sm" ? 5 : size === "lg" ? 8 : 6;
  const svgSize = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  // 75% arc (270deg sweep starting from bottom-left)
  const arcLength = circumference * 0.75;
  const progress = (score / 100) * arcLength;
  const color = scoreColor(score);

  function scoreLabel(s: number): string {
    if (s >= 80) return t("excellent");
    if (s >= 60) return t("good");
    if (s >= 40) return t("fair");
    return t("poor");
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg
          width={svgSize}
          height={svgSize}
          style={{ transform: "rotate(135deg)" }}
        >
          {/* Track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Progress */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold leading-none ${
              size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg"
            }`}
            style={{ color }}
          >
            {score}
          </span>
          {size !== "sm" && (
            <span className="text-xs text-gray-400 mt-0.5">
              {scoreLabel(score)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
