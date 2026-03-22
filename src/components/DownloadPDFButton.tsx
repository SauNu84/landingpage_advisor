"use client";

import dynamic from "next/dynamic";
import type { AnalysisResult } from "@/lib/experts/types";
import { ReportPDF } from "@/components/ReportPDF";

// PDFDownloadLink must be loaded client-side only — @react-pdf/renderer uses browser APIs
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

interface Props {
  result: AnalysisResult;
  slug?: string;
}

function buildFilename(result: AnalysisResult, slug?: string): string {
  const date = new Date(result.analysedAt).toISOString().slice(0, 10);
  let label = slug;
  if (!label) {
    try {
      label = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      label = "report";
    }
  }
  return `lpa-report-${label}-${date}.pdf`;
}

export function DownloadPDFButton({ result, slug }: Props) {
  const filename = buildFilename(result, slug);

  return (
    <PDFDownloadLink
      document={<ReportPDF result={result} slug={slug} />}
      fileName={filename}
    >
      {({ loading }) => (
        <button
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {loading ? "Preparing PDF…" : "Download PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
