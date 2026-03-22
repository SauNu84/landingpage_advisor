"use client";

import { useState } from "react";
import { useRouter } from "@/navigation";
import { useTranslations, useLocale } from "next-intl";
import { LoadingExpert } from "@/components/LoadingExpert";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UserNav } from "@/components/UserNav";

type Mode = "single" | "compare" | "bulk";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function HomePage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("HomePage");
  const tCommon = useTranslations("Common");
  const tAuth = useTranslations("Auth");

  const [mode, setMode] = useState<Mode>("single");
  const [url, setUrl] = useState("");
  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentExpert, setCurrentExpert] = useState(0);
  const [loadingLabels, setLoadingLabels] = useState<string[]>([]);

  const EXPERT_LABELS: string[] = [
    t("expertLabels.uiDesign"),
    t("expertLabels.uxResearch"),
    t("expertLabels.experiment"),
    t("expertLabels.content"),
    t("expertLabels.seo"),
    t("expertLabels.psychology"),
    t("expertLabels.posthog"),
  ];

  const COMPARE_EXPERT_LABELS: string[] = [
    t("compareExpertLabels.scraping"),
    t("compareExpertLabels.uiDesign"),
    t("compareExpertLabels.uxResearch"),
    t("compareExpertLabels.experiment"),
    t("compareExpertLabels.content"),
    t("compareExpertLabels.seo"),
    t("compareExpertLabels.psychology"),
    t("compareExpertLabels.posthog"),
  ];

  const EXPERT_BADGES: string[] = [
    t("expertBadges.uiDesign"),
    t("expertBadges.uxResearch"),
    t("expertBadges.experiment"),
    t("expertBadges.content"),
    t("expertBadges.seo"),
    t("expertBadges.psychology"),
    t("expertBadges.posthog"),
  ];

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

  function parseBulkUrls(text: string): string[] {
    return text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean)
      .map(normalise);
  }

  function startLoadingInterval(labels: string[]) {
    setCurrentExpert(0);
    const interval = setInterval(() => {
      setCurrentExpert((prev) =>
        prev < labels.length - 1 ? prev + 1 : prev
      );
    }, 4000);
    return interval;
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError(t("errors.enterUrl"));
      return;
    }

    const norm = normalise(url);
    if (!validateUrl(norm)) {
      setError(t("errors.invalidUrl"));
      return;
    }

    setLoading(true);
    setLoadingLabels(EXPERT_LABELS);
    const interval = startLoadingInterval(EXPERT_LABELS);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: norm }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? t("errors.analysisFailed"));
      }

      sessionStorage.setItem("analysisResult", JSON.stringify(data));
      router.push("/analyze", { locale });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errors.unexpected");
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
      setError(t("errors.enterBothUrls"));
      return;
    }

    const norm1 = normalise(url1);
    const norm2 = normalise(url2);

    if (!validateUrl(norm1) || !validateUrl(norm2)) {
      setError(t("errors.invalidBothUrls"));
      return;
    }

    setLoading(true);
    setLoadingLabels(COMPARE_EXPERT_LABELS);
    const interval = startLoadingInterval(COMPARE_EXPERT_LABELS);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url1: norm1, url2: norm2 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? t("errors.comparisonFailed"));
      }

      sessionStorage.setItem("compareResult", JSON.stringify(data));
      router.push("/compare", { locale });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errors.unexpected");
      setError(msg);
      setLoading(false);
    } finally {
      clearInterval(interval);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const urls = parseBulkUrls(bulkText);

    if (urls.length < 3) {
      setError(t("errors.bulkMinUrls"));
      return;
    }
    if (urls.length > 10) {
      setError(t("errors.bulkMaxUrls"));
      return;
    }

    const invalid = urls.find((u) => !validateUrl(u));
    if (invalid) {
      setError(t("errors.bulkInvalidUrl", { url: invalid }));
      return;
    }

    // Build per-URL loading labels
    const bulkLabels = urls.map(
      (u, i) => `${t("bulkForm.analyzingUrl", { n: i + 1, total: urls.length })}: ${hostname(u)}`
    );

    setLoading(true);
    setLoadingLabels(bulkLabels);
    const interval = startLoadingInterval(bulkLabels);

    try {
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? t("errors.bulkFailed"));
      }

      sessionStorage.setItem("bulkResult", JSON.stringify(data));
      router.push("/bulk", { locale });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errors.unexpected");
      setError(msg);
      setLoading(false);
    } finally {
      clearInterval(interval);
    }
  }

  if (loading) {
    return (
      <LoadingExpert
        experts={loadingLabels}
        currentIndex={currentExpert}
      />
    );
  }

  const bulkUrls = parseBulkUrls(bulkText);
  const bulkUrlCount = bulkUrls.length;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-end items-center gap-2 mb-2">
            <UserNav
              translations={{
                signIn: tAuth("signIn"),
                signOut: tAuth("signOut"),
                history: tAuth("history"),
                posthogSettings: tAuth("posthogSettings"),
                modal: {
                  title: tAuth("modal.title"),
                  emailLabel: tAuth("modal.emailLabel"),
                  emailPlaceholder: tAuth("modal.emailPlaceholder"),
                  sendCode: tAuth("modal.sendCode"),
                  sending: tAuth("modal.sending"),
                  codeLabel: tAuth("modal.codeLabel"),
                  codePlaceholder: tAuth("modal.codePlaceholder"),
                  verify: tAuth("modal.verify"),
                  verifying: tAuth("modal.verifying"),
                  back: tAuth("modal.back"),
                  close: tAuth("modal.close"),
                  emailSent: tAuth("modal.emailSent"),
                  invalidEmail: tAuth("modal.invalidEmail"),
                  invalidCode: tAuth("modal.invalidCode"),
                  errorGeneric: tAuth("modal.errorGeneric"),
                },
              }}
            />
            <LanguageSwitcher />
          </div>
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
            {tCommon("appName")}
          </h1>
          <p className="text-gray-500 text-lg">{t("subtitle")}</p>
        </div>

        {/* Expert badges */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {EXPERT_BADGES.map((label) => (
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
            {t("modeToggle.single")}
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
            {t("modeToggle.compare")}
          </button>
          <button
            type="button"
            onClick={() => { setMode("bulk"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "bulk"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("modeToggle.bulk")}
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
                {t("singleForm.label")}
              </label>
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("singleForm.placeholder")}
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
              {t("singleForm.button")}
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
                {t("compareForm.myPage")}
              </label>
              <input
                id="url1"
                type="text"
                value={url1}
                onChange={(e) => setUrl1(e.target.value)}
                placeholder={t("compareForm.myPagePlaceholder")}
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
                {t("compareForm.competitor")}
              </label>
              <input
                id="url2"
                type="text"
                value={url2}
                onChange={(e) => setUrl2(e.target.value)}
                placeholder={t("compareForm.competitorPlaceholder")}
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
              {t("compareForm.button")}
            </button>
          </form>
        )}

        {/* Bulk form */}
        {mode === "bulk" && (
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="bulk-urls"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t("bulkForm.label")}
                </label>
                {bulkUrlCount > 0 && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      bulkUrlCount < 3
                        ? "text-red-600 bg-red-50"
                        : bulkUrlCount > 10
                        ? "text-red-600 bg-red-50"
                        : "text-green-700 bg-green-50"
                    }`}
                  >
                    {t("bulkForm.urlCount", { count: bulkUrlCount })}
                  </span>
                )}
              </div>
              <textarea
                id="bulk-urls"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={t("bulkForm.placeholder")}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono resize-none"
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">{t("bulkForm.hint")}</p>
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
              {t("bulkForm.button")}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          {tCommon("poweredBy")}
        </p>
      </div>
    </main>
  );
}
