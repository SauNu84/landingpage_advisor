"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Link } from "@/navigation";

interface PostHogConfig {
  connected: boolean;
  projectId?: string;
  host?: string;
  apiKeyMasked?: string;
}

type TestStatus = "idle" | "loading" | "success" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function PostHogSettingsPage() {
  const router = useRouter();
  const t = useTranslations("PostHogSettings");
  const tCommon = useTranslations("Common");

  const [config, setConfig] = useState<PostHogConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [host, setHost] = useState("https://app.posthog.com");

  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    fetch("/api/settings/posthog")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/");
          return;
        }
        const data = await res.json();
        setConfig(data);
        if (data.connected) {
          setProjectId(data.projectId ?? "");
          setHost(data.host ?? "https://app.posthog.com");
        }
      })
      .catch(() => setConfig({ connected: false }))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      setTestMessage(t("errors.apiKeyAndProjectRequired"));
      setTestStatus("error");
      return;
    }
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await fetch("/api/settings/posthog/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), projectId: projectId.trim(), host: host.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestStatus("success");
        setTestMessage(t("testSuccess", { name: data.projectName }));
      } else {
        setTestStatus("error");
        setTestMessage(data.error ?? t("errors.testFailed"));
      }
    } catch {
      setTestStatus("error");
      setTestMessage(t("errors.testFailed"));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      setSaveError(t("errors.apiKeyAndProjectRequired"));
      return;
    }
    setSaveStatus("saving");
    setSaveError("");
    try {
      const res = await fetch("/api/settings/posthog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), projectId: projectId.trim(), host: host.trim() }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        setConfig({ connected: true, projectId: projectId.trim(), host: host.trim(), apiKeyMasked: "••••••" + apiKey.trim().slice(-6) });
        setApiKey("");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error ?? t("errors.saveFailed"));
        setSaveStatus("error");
      }
    } catch {
      setSaveError(t("errors.saveFailed"));
      setSaveStatus("error");
    }
  }

  async function handleDisconnect() {
    if (!confirm(t("disconnectConfirm"))) return;
    await fetch("/api/settings/posthog", { method: "DELETE" });
    setConfig({ connected: false });
    setApiKey("");
    setProjectId("");
    setHost("https://app.posthog.com");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.36 3.36 0 0114 17H10a3.36 3.36 0 01-2.39-.991l-.346-.346z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">{tCommon("appName")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/" className="text-sm text-indigo-600 font-medium hover:underline">
              {t("back")}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
              <p className="text-sm text-gray-500">{t("subtitle")}</p>
            </div>
          </div>
        </div>

        {/* Current status */}
        {config?.connected && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-800">{t("connectedStatus")}</p>
              <p className="text-xs text-green-700 mt-0.5">
                {t("projectId")}: <code className="font-mono">{config.projectId}</code>
              </p>
              <p className="text-xs text-green-700">
                {t("apiKey")}: <code className="font-mono">{config.apiKeyMasked}</code>
              </p>
              <p className="text-xs text-green-700">
                {t("host")}: <code className="font-mono">{config.host}</code>
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex-shrink-0 text-xs text-red-600 hover:text-red-700 font-medium border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
            >
              {t("disconnect")}
            </button>
          </div>
        )}

        {/* Connection form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            {config?.connected ? t("updateConnection") : t("connectTitle")}
          </h2>
          <p className="text-sm text-gray-500 mb-5">{t("connectDescription")}</p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("apiKeyLabel")}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.connected ? t("apiKeyPlaceholderUpdate") : "phx_..."}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">{t("apiKeyHint")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("projectIdLabel")}
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="12345"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">{t("projectIdHint")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("hostLabel")}
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="https://app.posthog.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">{t("hostHint")}</p>
            </div>

            {/* Test connection result */}
            {testStatus !== "idle" && (
              <div
                className={`text-sm px-3 py-2 rounded-lg border ${
                  testStatus === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : testStatus === "error"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-indigo-50 border-indigo-200 text-indigo-700"
                }`}
              >
                {testStatus === "loading" ? t("testing") : testMessage}
              </div>
            )}

            {saveStatus === "error" && saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}

            {saveStatus === "saved" && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {t("savedSuccess")}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testStatus === "loading"}
                className="flex-1 py-2.5 border border-gray-300 hover:border-indigo-400 text-sm font-medium rounded-xl text-gray-700 hover:text-indigo-700 transition-colors disabled:opacity-50"
              >
                {testStatus === "loading" ? t("testing") : t("testButton")}
              </button>
              <button
                type="submit"
                disabled={saveStatus === "saving"}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saveStatus === "saving" ? t("saving") : t("saveButton")}
              </button>
            </div>
          </form>
        </div>

        {/* Info box */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange-800 mb-1">{t("infoTitle")}</p>
          <p className="text-xs text-orange-700 leading-relaxed">{t("infoBody")}</p>
        </div>
      </div>
    </main>
  );
}
