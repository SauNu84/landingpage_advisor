"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

interface HistoryItem {
  id: string;
  slug: string;
  url: string;
  secondaryUrl: string | null;
  overallScore: number | null;
  expertScores: Record<string, number>;
  createdAt: string;
  isComparison: boolean;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 75
      ? "bg-green-100 text-green-700"
      : score >= 50
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold ${color}`}>
      {score}
    </span>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const t = useTranslations("History");
  const tAuth = useTranslations("Auth");

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notAuthed, setNotAuthed] = useState(false);

  const fetchHistory = useCallback(async (cursor?: string) => {
    const url = cursor ? `/api/history?cursor=${cursor}` : "/api/history";
    const res = await fetch(url);
    if (res.status === 401) {
      setNotAuthed(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    return data as { results: HistoryItem[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    fetchHistory().then((data) => {
      if (data) {
        setItems(data.results);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    });
  }, [fetchHistory]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const data = await fetchHistory(nextCursor);
    if (data) {
      setItems((prev) => [...prev, ...data.results]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">{t("loading")}</div>
      </main>
    );
  }

  if (notAuthed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("signInRequired")}</h2>
          <p className="text-gray-500 text-sm mb-6">{t("signInRequiredDesc")}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            {t("goHome")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-500 text-sm mt-1">{t("subtitle")}</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {t("analyzeNew")}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">{t("empty")}</p>
            <p className="text-gray-400 text-sm mt-1">{t("emptyDesc")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/r/${item.slug}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.isComparison && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          {t("comparison")}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">
                      {hostname(item.url)}
                    </p>
                    {item.secondaryUrl && (
                      <p className="text-sm text-gray-500 truncate">
                        vs {hostname(item.secondaryUrl)}
                      </p>
                    )}
                    {Object.keys(item.expertScores).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(item.expertScores).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                          >
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <ScoreBadge score={item.overallScore} />
                  </div>
                </div>
              </Link>
            ))}

            {nextCursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 text-sm font-medium text-indigo-600 bg-white border border-gray-200 rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? t("loadingMore") : t("loadMore")}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
